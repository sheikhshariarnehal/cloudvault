"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatBytes } from "@/lib/admin/format";

type FileTypeBreakdownItem = {
  name: string;
  files: number;
  bytes: number;
};

type OverviewFileTypesChartProps = {
  data: FileTypeBreakdownItem[];
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#64748b", "#ef4444"];

export default function OverviewFileTypesChart({ data }: OverviewFileTypesChartProps) {
  return (
    <div className="h-[240px] w-full sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="bytes" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={96} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: "8px", color: "white" }}
            itemStyle={{ color: "white" }}
            formatter={(value, _name, item) => [formatBytes(Number(value ?? 0)), String(item?.payload?.name ?? "") ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
