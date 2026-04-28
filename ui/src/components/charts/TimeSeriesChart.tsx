"use client";

import type { TimeSeriesPoint } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  lines: Array<{ key: keyof TimeSeriesPoint; color: string; name: string }>;
  yAxisLabel?: string;
}

function fillDateGaps(data: TimeSeriesPoint[]): TimeSeriesPoint[] {
  if (data.length === 0) return data;

  const sorted = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const start = new Date(sorted[0].date);
  const end = new Date(sorted[sorted.length - 1].date);

  const dateMap = new Map<string, TimeSeriesPoint>();
  for (const point of sorted) {
    dateMap.set(point.date, point);
  }

  const filled: TimeSeriesPoint[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = cursor.toISOString().split("T")[0];
    if (dateMap.has(iso)) {
      filled.push(dateMap.get(iso)!);
    } else {
      filled.push({
        date: iso,
        request_count: 0,
        total_tokens: 0,
        total_cost_usd: 0,
        avg_latency_ms: 0,
        p50_latency_ms: null,
        p95_latency_ms: null,
        error_rate: 0,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return filled;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#111111] p-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-[#a1a1a1]">
        {label ? formatDateLabel(label) : ""}
      </p>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[#ededed]">{entry.name}:</span>
            <span className="font-medium text-[#ededed]">
              {typeof entry.value === "number"
                ? entry.value.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimeSeriesChart({
  data,
  lines,
  yAxisLabel,
}: TimeSeriesChartProps) {
  const filledData = fillDateGaps(data);

  if (filledData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={filledData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateLabel}
          tick={{ fill: "#a1a1a1", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
          minTickGap={30}
        />
        <YAxis
          tick={{ fill: "#a1a1a1", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
          label={
            yAxisLabel
              ? {
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#a1a1a1", fontSize: 11 },
                }
              : undefined
          }
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#a1a1a1" }}
          iconType="circle"
          iconSize={8}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
