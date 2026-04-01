"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type UploadVolumePoint = {
  date: string;
  uploads: number;
  bytes: number;
};

type OverviewUploadVolumeChartProps = {
  data: UploadVolumePoint[];
};

const GB = 1024 * 1024 * 1024;

export default function OverviewUploadVolumeChart({ data }: OverviewUploadVolumeChartProps) {
  const chartData = data.map((item) => ({
    label: item.date.slice(5),
    uploads: item.uploads,
    gb: Number((item.bytes / GB).toFixed(2)),
  }));

  return (
    <div className="h-[240px] w-full sm:h-[280px] lg:h-[320px]">
      <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-2,#00bb7f)]" />
          <span>Uploads</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-1,#3b82f6)]" />
          <span>Volume (GB)</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="92%">
        <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground, #ffffff)" opacity={0.12} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} tick={{ fontSize: 12, fill: "#888888" }} />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#888888" }}
            width={36}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#888888" }}
            width={44}
            tickFormatter={(value) => `${value}G`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "rgba(0,0,0,0.86)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "white" }}
            itemStyle={{ color: "white" }}
            labelStyle={{ color: "white", fontWeight: 600 }}
            formatter={(value, name) => {
              if (name === "gb") {
                if (value == null || Number.isNaN(Number(value))) return ["-", "Volume"];
                return [`${Number(value).toFixed(2)} GB`, "Volume"];
              }

              if (name === "uploads") {
                return [Number(value ?? 0).toLocaleString(), "Uploads"];
              }

              return [String(value ?? "-"), String(name ?? "")];
            }}
          />
          <Bar 
            yAxisId="left" 
            dataKey="uploads" 
            fill="var(--chart-2, #00bb7f)" 
            fillOpacity={0.95} 
            radius={[4, 4, 0, 0]} 
            maxBarSize={18} 
          />
          <Bar 
            yAxisId="right"
            dataKey="gb"
            fill="var(--chart-1, #3b82f6)"
            fillOpacity={0.95}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
