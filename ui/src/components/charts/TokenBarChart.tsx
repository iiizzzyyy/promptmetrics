"use client";

import type { PromptMetric } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface TokenBarChartProps {
  data: PromptMetric[];
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
      <p className="mb-2 text-xs font-medium text-[#a1a1a1]">{label}</p>
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
                ? entry.value.toLocaleString()
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TokenBarChart({ data }: TokenBarChartProps) {
  const sorted = [...data].sort(
    (a, b) =>
      b.total_tokens_in +
      b.total_tokens_out -
      (a.total_tokens_in + a.total_tokens_out)
  );

  if (sorted.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={sorted}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="prompt_name"
          tick={{ fill: "#a1a1a1", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
          angle={-30}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis
          tick={{ fill: "#a1a1a1", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#a1a1a1" }}
          iconType="circle"
          iconSize={8}
        />
        <Bar
          dataKey="total_tokens_in"
          name="Tokens In"
          stackId="tokens"
          fill="#389438"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="total_tokens_out"
          name="Tokens Out"
          stackId="tokens"
          fill="#5cc15c"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
