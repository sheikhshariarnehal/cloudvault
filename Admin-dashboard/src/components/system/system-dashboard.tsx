"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Database, RefreshCw, Server, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/admin/format";

type MetricsPayload = {
  timestamp: string;
  system: {
    uptime: number;
    memory: {
      total: number;
      free: number;
      used: number;
      usagePercent: string;
    };
    cpu: {
      loadAverage: number[];
    };
  };
  tdlib: {
    ready: boolean;
    activeSessions: number;
    maxSessions: number;
  };
  cache: {
    cachedFiles?: number;
    totalSizeBytes?: number;
    totalEntries?: number;
    appManagedBytes?: number;
    hitRate?: string;
    entries?: Array<{ id: string; size: number; isAppManaged: boolean; lastAccessed: number }>;
  };
};

type StoragePayload = {
  timestamp: string;
  storage: {
    tdlibData: { bytes: number; files: number };
    tdlibFiles: { bytes: number; files: number };
    appTemp: { bytes: number; files: number };
    uploads: { bytes: number; files: number };
    cleanable: { files: number; bytes: number };
    uploadsCleanable: { files: number; bytes: number; minAgeHours: number };
  };
};

type LogsPayload = {
  logs: Array<string | { msg?: string; message?: string; type?: string; timestamp?: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMetricsPayload(value: unknown): value is MetricsPayload {
  if (!isRecord(value)) {
    return false;
  }

  return isRecord(value.system) && isRecord(value.tdlib) && isRecord(value.cache);
}

function isStoragePayload(value: unknown): value is StoragePayload {
  return isRecord(value) && isRecord(value.storage);
}

function isLogsPayload(value: unknown): value is LogsPayload {
  return isRecord(value) && Array.isArray(value.logs);
}

function toLogLine(entry: LogsPayload["logs"][number]): string {
  if (typeof entry === "string") {
    return entry;
  }

  const message = entry.msg ?? entry.message ?? "";
  const type = entry.type ? entry.type.toUpperCase() : "INFO";
  const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "";
  const prefix = timestamp ? `[${timestamp}] [${type}]` : `[${type}]`;

  return message ? `${prefix} ${message}` : prefix;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function SystemDashboard() {
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [storage, setStorage] = useState<StoragePayload | null>(null);
  const [logs, setLogs] = useState<LogsPayload["logs"]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<"cache" | "optimize" | "cleanup" | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = async () => {
    const [m, s, l] = await Promise.all([
      fetchJson<unknown>("/api/admin/metrics"),
      fetchJson<unknown>("/api/admin/storage"),
      fetchJson<unknown>("/api/admin/logs"),
    ]);

    setMetrics(isMetricsPayload(m) ? m : null);
    setStorage(isStoragePayload(s) ? s : null);
    setLogs(isLogsPayload(l) ? l.logs : []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
    intervalRef.current = setInterval(() => {
      void loadData();
    }, 10_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const runAction = async (action: "cache" | "optimize" | "cleanup") => {
    setRunningAction(action);

    const endpoint =
      action === "cache"
        ? "/api/admin/cache/clear"
        : action === "optimize"
          ? "/api/admin/tdlib/optimize"
          : "/api/admin/storage/cleanup";

    await fetch(endpoint, { method: "POST" });
    await loadData();
    setRunningAction(null);
  };

  const statusReady = metrics?.tdlib?.ready ?? false;
  const cacheSizeBytes = metrics?.cache.totalSizeBytes ?? metrics?.cache.appManagedBytes ?? 0;
  const cacheFiles =
    metrics?.cache.cachedFiles ??
    metrics?.cache.totalEntries ??
    metrics?.cache.entries?.length ??
    0;
  const cacheHitRate = metrics?.cache.hitRate ?? "N/A";

  return (
    <div className="flex-1 space-y-4">
      <div className="mb-4 flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Metrics</h2>
          <p className="text-muted-foreground">Live TDLib backend metrics and maintenance controls.</p>
        </div>
        <Badge
          variant="outline"
          className={statusReady ? "border-green-200 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}
        >
          {statusReady ? "TDLib Ready" : "Connecting"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading || !metrics ? "-" : formatBytes(metrics.system.memory.used)}</div>
            <p className="text-xs text-muted-foreground">
              {loading || !metrics ? "" : `${formatBytes(metrics.system.memory.total)} total · ${metrics.system.memory.usagePercent}%`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active TDLib Sessions</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading || !metrics ? "-" : metrics.tdlib.activeSessions}</div>
            <p className="text-xs text-muted-foreground">
              {loading || !metrics ? "" : `Max: ${metrics.tdlib.maxSessions}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading || !metrics ? "-" : formatBytes(cacheSizeBytes)}</div>
            <p className="text-xs text-muted-foreground">
              {loading || !metrics ? "" : `Hit rate: ${cacheHitRate} · Files: ${cacheFiles}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Storage Buckets</CardTitle>
            <CardDescription>Current disk usage from tdlib-service stats.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span>tdlib-data</span><span>{storage ? formatBytes(storage.storage.tdlibData.bytes) : "-"}</span></div>
            <div className="flex items-center justify-between"><span>tdlib-files</span><span>{storage ? formatBytes(storage.storage.tdlibFiles.bytes) : "-"}</span></div>
            <div className="flex items-center justify-between"><span>temp</span><span>{storage ? formatBytes(storage.storage.appTemp.bytes) : "-"}</span></div>
            <div className="flex items-center justify-between"><span>uploads</span><span>{storage ? formatBytes(storage.storage.uploads.bytes) : "-"}</span></div>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void runAction("cache")} disabled={runningAction !== null}>
                <Trash2 className="mr-2 h-4 w-4" />
                {runningAction === "cache" ? "Clearing..." : "Clear Cache"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void runAction("optimize")} disabled={runningAction !== null}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {runningAction === "optimize" ? "Running..." : "Optimize TDLib"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void runAction("cleanup")} disabled={runningAction !== null}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {runningAction === "cleanup" ? "Cleaning..." : "Cleanup Temp"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Logs</CardTitle>
            <CardDescription>Auto-refreshed every 10 seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md bg-black p-4 text-xs text-green-400">
              {(logs.length ? logs.slice(-40).map(toLogLine) : ["No logs returned."]).join("\n")}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
