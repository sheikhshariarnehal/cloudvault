"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatBytes } from "@/lib/admin/format";

type TrendPoint = {
  date: string;
  totalBytes: number;
};

type Props = {
  data: TrendPoint[];
};

export default function StorageGrowthChart({ data }: Props) {
  // Calculate cumulative growth
  const chartData = useMemo(() => {
    let cumulative = 0;
    return data.map((d) => {
      cumulative += d.totalBytes;
      return {
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        totalBytes: cumulative,
      };
    });
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorBytes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--foreground, #ffffff)" opacity={0.1} />
        <XAxis 
          dataKey="date" 
          tickLine={false} 
          axisLine={false} 
          tick={{ fontSize: 12 }} 
          dy={10} 
        />
        <YAxis
          tickFormatter={(val) => formatBytes(val)}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">
                        Date
                      </span>
                      <span className="font-bold text-muted-foreground">
                        {label}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">
                        Storage
                      </span>
                      <span className="font-bold">
                        {formatBytes(payload[0].value as number)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Area
          type="monotone"
          dataKey="totalBytes"
          stroke="#3b82f6"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorBytes)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}