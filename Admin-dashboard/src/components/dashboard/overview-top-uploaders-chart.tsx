"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TopUploaderItem = {
  name: string;
  uploads: number;
  bytes: number;
};

type OverviewTopUploadersChartProps = {
  data: TopUploaderItem[];
};

const GB = 1024 * 1024 * 1024;

export default function OverviewTopUploadersChart({ data }: OverviewTopUploadersChartProps) {
  const chartData = data.map((item) => ({
    name: item.name.length > 18 ? `${item.name.slice(0, 18)}...` : item.name,
    uploads: item.uploads,
    gb: Number((item.bytes / GB).toFixed(2)),
  }));

  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 8 }}>
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#888888" }} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 12, fill: "#888888" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: "8px", color: "white" }}
            itemStyle={{ color: "white" }}
            formatter={(value, key) => {
              const numericValue = Number(value ?? 0);
              const keyLabel = String(key ?? "");

              if (keyLabel === "gb") return [`${numericValue.toFixed(2)} GB`, "Uploaded Size"];
              if (keyLabel === "uploads") return [numericValue, "Uploads"];
              return [numericValue, keyLabel];
            }}
          />
          <Bar dataKey="gb" fill="var(--chart-1, #ffffff)" radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
