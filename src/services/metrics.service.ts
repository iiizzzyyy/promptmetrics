import { getDb } from '@models/promptmetrics-sqlite';
import { parsePagination, buildPaginatedResponse, PaginatedResponse, parseCountRow } from '@utils/pagination';

export interface TimeSeriesPoint {
  date: string;
  request_count: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  error_rate: number;
}

export interface PromptMetric {
  prompt_name: string;
  version_tag: string;
  request_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  error_rate: number;
}

export interface EvaluationTrendPoint {
  date: string;
  avg_score: number;
  result_count: number;
  min_score: number;
  max_score: number;
}

export interface EvaluationTrend {
  evaluation_id: number;
  name: string;
  prompt_name: string;
  trend: EvaluationTrendPoint[];
}

export interface ActivitySummary {
  total_runs: number;
  total_traces: number;
  total_logs: number;
  total_evaluations: number;
  active_prompts: number;
  failed_runs: number;
}

export interface ActivityResponse {
  window: string;
  summary: ActivitySummary;
  recent_runs: PaginatedResponse<unknown>;
}

function formatDateBucket(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value);
}

export class MetricsService {
  private getDateBucket(column: string, dialect: 'sqlite' | 'postgres'): string {
    if (dialect === 'sqlite') {
      return `date(${column}, 'unixepoch')`;
    }
    return `TO_TIMESTAMP(${column})::DATE`;
  }

  async getTimeSeries(workspaceId: string = 'default', start: number, end: number): Promise<TimeSeriesPoint[]> {
    const db = getDb();
    const dialect = db.dialect;
    const dateBucket = this.getDateBucket('l.created_at', dialect);

    const logSql = `
      SELECT
        ${dateBucket} as date,
        COUNT(*) as request_count,
        COALESCE(SUM(l.tokens_in + l.tokens_out), 0) as total_tokens,
        COALESCE(SUM(l.cost_usd), 0) as total_cost_usd,
        COALESCE(AVG(l.latency_ms), 0) as avg_latency_ms
        ${dialect === 'postgres' ? `, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.latency_ms) as p50_latency_ms
        , PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY l.latency_ms) as p95_latency_ms` : ''}
      FROM logs l
      WHERE l.workspace_id = ? AND l.created_at >= ? AND l.created_at <= ?
      GROUP BY ${dateBucket}
      ORDER BY ${dateBucket}
    `;

    const logRows = (await db.prepare(logSql).all(workspaceId, start, end)) as Array<{
      date: unknown;
      request_count: number;
      total_tokens: number;
      total_cost_usd: number;
      avg_latency_ms: number;
      p50_latency_ms: number | null;
      p95_latency_ms: number | null;
    }>;

    const runDateBucket = this.getDateBucket('r.created_at', dialect);
    const runRows = (await db.prepare(`
      SELECT
        ${runDateBucket} as date,
        COUNT(*) as total_runs,
        SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed_runs
      FROM runs r
      WHERE r.workspace_id = ? AND r.created_at >= ? AND r.created_at <= ?
      GROUP BY ${runDateBucket}
    `).all(workspaceId, start, end)) as Array<{
      date: unknown;
      total_runs: number;
      failed_runs: number;
    }>;

    const runMap = new Map<string, { total_runs: number; failed_runs: number }>();
    for (const r of runRows) {
      runMap.set(formatDateBucket(r.date), { total_runs: r.total_runs, failed_runs: r.failed_runs });
    }

    return logRows.map((l) => {
      const dateStr = formatDateBucket(l.date);
      const runData = runMap.get(dateStr);
      const errorRate = runData && runData.total_runs > 0 ? runData.failed_runs / runData.total_runs : 0;
      return {
        date: dateStr,
        request_count: l.request_count,
        total_tokens: l.total_tokens,
        total_cost_usd: l.total_cost_usd,
        avg_latency_ms: l.avg_latency_ms,
        p50_latency_ms: dialect === 'postgres' ? (l.p50_latency_ms ?? null) : null,
        p95_latency_ms: dialect === 'postgres' ? (l.p95_latency_ms ?? null) : null,
        error_rate: errorRate,
      };
    });
  }

  async getPromptMetrics(
    workspaceId: string = 'default',
    start: number,
    end: number,
    limit: number = 50,
  ): Promise<PromptMetric[]> {
    const db = getDb();
    const rows = (await db.prepare(`
      SELECT
        l.prompt_name,
        l.version_tag,
        COUNT(*) as request_count,
        COALESCE(SUM(l.tokens_in), 0) as total_tokens_in,
        COALESCE(SUM(l.tokens_out), 0) as total_tokens_out,
        COALESCE(SUM(l.cost_usd), 0) as total_cost_usd,
        COALESCE(AVG(l.latency_ms), 0) as avg_latency_ms
      FROM logs l
      WHERE l.workspace_id = ? AND l.created_at >= ? AND l.created_at <= ?
      GROUP BY l.prompt_name, l.version_tag
      ORDER BY total_cost_usd DESC
      LIMIT ?
    `).all(workspaceId, start, end, limit)) as Array<{
      prompt_name: string;
      version_tag: string;
      request_count: number;
      total_tokens_in: number;
      total_tokens_out: number;
      total_cost_usd: number;
      avg_latency_ms: number;
    }>;

    return rows.map((r) => ({
      prompt_name: r.prompt_name,
      version_tag: r.version_tag,
      request_count: r.request_count,
      total_tokens_in: r.total_tokens_in,
      total_tokens_out: r.total_tokens_out,
      total_cost_usd: r.total_cost_usd,
      avg_latency_ms: r.avg_latency_ms,
      error_rate: 0,
    }));
  }

  async getEvaluationTrends(
    workspaceId: string = 'default',
    start: number,
    end: number,
    evaluationId?: number,
  ): Promise<EvaluationTrend[]> {
    const db = getDb();
    const dialect = db.dialect;
    const dateBucket = this.getDateBucket('r.created_at', dialect);

    const rows = (await db.prepare(`
      SELECT
        e.id as evaluation_id,
        e.name,
        e.prompt_name,
        ${dateBucket} as date,
        AVG(r.score) as avg_score,
        COUNT(*) as result_count,
        MIN(r.score) as min_score,
        MAX(r.score) as max_score
      FROM evaluations e
      JOIN evaluation_results r ON e.id = r.evaluation_id
      WHERE e.workspace_id = ? AND r.workspace_id = ? AND r.created_at >= ? AND r.created_at <= ?
        AND (? IS NULL OR e.id = ?)
      GROUP BY e.id, ${dateBucket}
      ORDER BY e.id, ${dateBucket}
    `).all(workspaceId, workspaceId, start, end, evaluationId ?? null, evaluationId ?? null)) as Array<{
      evaluation_id: number;
      name: string;
      prompt_name: string;
      date: unknown;
      avg_score: number;
      result_count: number;
      min_score: number;
      max_score: number;
    }>;

    const trendMap = new Map<number, EvaluationTrend>();
    for (const row of rows) {
      let trend = trendMap.get(row.evaluation_id);
      if (!trend) {
        trend = {
          evaluation_id: row.evaluation_id,
          name: row.name,
          prompt_name: row.prompt_name,
          trend: [],
        };
        trendMap.set(row.evaluation_id, trend);
      }
      trend.trend.push({
        date: formatDateBucket(row.date),
        avg_score: row.avg_score,
        result_count: row.result_count,
        min_score: row.min_score,
        max_score: row.max_score,
      });
    }

    return Array.from(trendMap.values());
  }

  async getActivitySummary(
    workspaceId: string = 'default',
    windowStart: number,
    page: number = 1,
    limit: number = 10,
    window: string = '30d',
  ): Promise<ActivityResponse> {
    const db = getDb();

    const totalRuns = parseCountRow(
      await db.prepare('SELECT COUNT(*) as c FROM runs WHERE workspace_id = ? AND created_at >= ?').get(workspaceId, windowStart),
    );
    const totalTraces = parseCountRow(
      await db.prepare('SELECT COUNT(*) as c FROM traces WHERE workspace_id = ? AND created_at >= ?').get(workspaceId, windowStart),
    );
    const totalLogs = parseCountRow(
      await db.prepare('SELECT COUNT(*) as c FROM logs WHERE workspace_id = ? AND created_at >= ?').get(workspaceId, windowStart),
    );
    const totalEvaluations = parseCountRow(
      await db.prepare('SELECT COUNT(*) as c FROM evaluation_results WHERE workspace_id = ? AND created_at >= ?').get(workspaceId, windowStart),
    );
    const activePrompts = parseCountRow(
      await db.prepare("SELECT COUNT(DISTINCT name) as c FROM prompts WHERE workspace_id = ? AND status = 'active'").get(workspaceId),
    );
    const failedRuns = parseCountRow(
      await db.prepare("SELECT COUNT(*) as c FROM runs WHERE workspace_id = ? AND created_at >= ? AND status = 'failed'").get(workspaceId, windowStart),
    );

    const { offset } = parsePagination({ page: String(page), limit: String(limit) });
    const recentRunItems = (await db.prepare(`
      SELECT run_id, workflow_name, status, input_json, output_json, trace_id, metadata_json, created_at, updated_at
      FROM runs
      WHERE workspace_id = ? AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(workspaceId, windowStart, limit, offset)) as Array<{
      run_id: string;
      workflow_name: string;
      status: string;
      input_json: string | null;
      output_json: string | null;
      trace_id: string | null;
      metadata_json: string | null;
      created_at: number;
      updated_at: number;
    }>;

    const recentRuns = buildPaginatedResponse(
      recentRunItems.map((r) => ({
        run_id: r.run_id,
        workflow_name: r.workflow_name,
        status: r.status,
        input: r.input_json ? JSON.parse(r.input_json) : null,
        output: r.output_json ? JSON.parse(r.output_json) : null,
        trace_id: r.trace_id,
        metadata: r.metadata_json ? JSON.parse(r.metadata_json) : {},
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      totalRuns,
      page,
      limit,
    );

    return {
      window,
      summary: {
        total_runs: totalRuns,
        total_traces: totalTraces,
        total_logs: totalLogs,
        total_evaluations: totalEvaluations,
        active_prompts: activePrompts,
        failed_runs: failedRuns,
      },
      recent_runs: recentRuns,
    };
  }
}
