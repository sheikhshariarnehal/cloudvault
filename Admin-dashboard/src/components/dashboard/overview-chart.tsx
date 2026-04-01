"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";
import { formatBytes } from "@/lib/admin/format";

type OverviewChartPoint = {
  date: string;
  total: number;
};

type OverviewChartProps = {
  data: OverviewChartPoint[];
};

export default function OverviewChart({ data }: OverviewChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");

    const syncBreakpoint = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    syncBreakpoint(mediaQuery);
    mediaQuery.addEventListener("change", syncBreakpoint);

    return () => {
      mediaQuery.removeEventListener("change", syncBreakpoint);
    };
  }, []);

  const chartData = data.map((item) => ({
    name: item.date.slice(5),
    total: item.total,
  }));

  return (
    <div className="h-[250px] w-full sm:h-[300px] lg:h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 12, right: isMobile ? 12 : 24, left: isMobile ? -24 : -12, bottom: 0 }}
        >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.2} />
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={isMobile ? 22 : 32}
          tickMargin={12}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatBytes(value).replace(' ', '')}
          width={isMobile ? 50 : 60}
        />
        <Tooltip
           contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: "8px", color: "white" }}
           itemStyle={{ color: "white" }}
            formatter={(value) => {
             const bytes = typeof value === "number" ? value : Number(value ?? 0);
             return [formatBytes(Number.isFinite(bytes) ? bytes : 0), "Storage"];
            }}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6, fill: "#3b82f6" }}
        />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
