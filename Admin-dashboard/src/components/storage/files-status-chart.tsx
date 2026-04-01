"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatBytes } from "@/lib/admin/format";

const COLORS = ["#10b981", "#ef4444"]; // Emerald for active, Red for trashed

type StatusItem = {
  status: string;
  totalBytes: number;
  count: number;
};

type Props = {
  data: StatusItem[];
};

export default function FilesStatusChart({ data }: Props) {
  return (
    <div className="grid w-full min-w-0 gap-4 lg:min-h-[300px] lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.9fr)]">
      <div className="min-w-0 h-[220px] sm:h-[260px] lg:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={90}
              paddingAngle={5}
              dataKey="totalBytes"
              nameKey="status"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const payloadData = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <p className="font-medium">{payloadData.status}</p>
                      <p className="text-sm text-muted-foreground">{formatBytes(payloadData.totalBytes)}</p>
                      <p className="text-xs text-muted-foreground">{payloadData.count} files</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex min-w-0 flex-col justify-center space-y-3 px-1 sm:px-2 lg:px-4">
        {data.map((item, i) => (
          <div key={item.status} className="flex items-center justify-between border-b border-border py-2 last:border-0 last:pb-0">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[i % COLORS.length] }} 
              />
              <span className="text-sm font-medium">{item.status}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{formatBytes(item.totalBytes)}</p>
              <p className="text-xs text-muted-foreground">{item.count} files</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
