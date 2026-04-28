"use client";

import type { EvaluationTrendPoint } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface ScoreTrendChartProps {
  data: EvaluationTrendPoint[];
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

  const avg = payload.find((p) => p.name === "Avg Score")?.value;
  const min = payload.find((p) => p.name === "Min")?.value;
  const max = payload.find((p) => p.name === "Max")?.value;

  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#111111] p-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-[#a1a1a1]">
        {label ? formatDateLabel(label) : ""}
      </p>
      <div className="space-y-1">
        {avg !== undefined && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2 w-2 rounded-full bg-[#389438]" />
            <span className="text-[#ededed]">Avg Score:</span>
            <span className="font-medium text-[#ededed]">
              {Number(avg).toFixed(2)}
            </span>
          </div>
        )}
        {min !== undefined && max !== undefined && (
          <div className="text-xs text-[#a1a1a1]">
            Range: {Number(min).toFixed(2)} - {Number(max).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#389438" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#389438" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5cc15c" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#5cc15c" stopOpacity={0.01} />
          </linearGradient>
        </defs>
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
          width={50}
          domain={[0, "auto"]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="max_score"
          name="Max"
          stroke="transparent"
          fill="url(#rangeGradient)"
          connectNulls
        />
        <Area
          type="monotone"
          dataKey="min_score"
          name="Min"
          stroke="transparent"
          fill="transparent"
          connectNulls
        />
        <Area
          type="monotone"
          dataKey="avg_score"
          name="Avg Score"
          stroke="#389438"
          strokeWidth={2}
          fill="url(#scoreGradient)"
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
