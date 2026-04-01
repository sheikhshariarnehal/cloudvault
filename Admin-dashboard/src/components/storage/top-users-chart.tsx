"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

type TopUsersChartItem = {
  name: string;
  usage: number; // in GB
};

type TopUsersChartProps = {
  data: TopUsersChartItem[];
};

function truncateLabel(value: string, max = 14) {
  const compact = value.trim().replace(/\s+/g, " ");
  const shortened = compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
  return shortened.replace(/\s+/g, "·");
}

export default function TopUsersChart({ data }: TopUsersChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    label: truncateLabel(item.name),
  }));

  const chartHeight = Math.max(280, chartData.length * 28 + 20);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 6, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--foreground, #ffffff)" opacity={0.1} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={92}
          interval={0}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }}
        />
        <Tooltip
          cursor={{ fill: "transparent" }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const itemData = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <p className="font-medium text-sm">{itemData.name}</p>
                  <p className="text-sm font-bold text-blue-500">{itemData.usage.toFixed(2)} GB</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar 
          dataKey="usage" 
          fill="#3b82f6" 
          radius={[0, 4, 4, 0]} 
          barSize={14}
          minPointSize={3}
          animationDuration={1000}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
