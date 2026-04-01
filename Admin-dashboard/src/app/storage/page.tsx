import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import StorageBreakdownChart from "@/components/storage/storage-breakdown-chart";
import TopUsersChart from "@/components/storage/top-users-chart";
import StorageGrowthChart from "@/components/storage/storage-growth-chart";
import FilesStatusChart from "@/components/storage/files-status-chart";
import MissingEnvNotice from "@/components/admin/missing-env-notice";
import { formatBytes } from "@/lib/admin/format";
import { 
  getStorageBreakdown, 
  getTopUsersByStorage, 
  getUsers,
  getStorageGrowthTrend,
  getFilesStatusBreakdown
} from "@/lib/admin/queries";
import { isMissingAdminSupabaseEnvError } from "@/lib/supabase";
import { HardDrive, CloudLightning, Activity, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StoragePage() {
  let topUsersRaw, breakdown, users, growthTrend, filesStatus;

  try {
    [topUsersRaw, breakdown, users, growthTrend, filesStatus] = await Promise.all([
      getTopUsersByStorage(10), 
      getStorageBreakdown(), 
      getUsers(500),
      getStorageGrowthTrend(30),
      getFilesStatusBreakdown()
    ]);
  } catch (error) {
    if (isMissingAdminSupabaseEnvError(error)) {
      return <MissingEnvNotice title="Storage analytics unavailable" />;
    }
    throw error;
  }

  const totalUsed = users.reduce((sum, user) => sum + user.storageUsedBytes, 0);
  const totalLimit = users.reduce((sum, user) => sum + user.storageLimitBytes, 0);
  const usagePercent = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

  const topUsers = topUsersRaw.map((item) => ({
    name: item.name,
    usage: Number((item.usage / (1024 * 1024 * 1024)).toFixed(2)),
  }));

  const activeFilesBytes = filesStatus.find(s => s.status === "Active Files")?.totalBytes || 0;
  const trashedFilesBytes = filesStatus.find(s => s.status === "Trashed Files")?.totalBytes || 0;

  return (
    <div className="flex-1 w-full min-w-0 space-y-4 !max-w-none !mx-0 !p-0">
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">Storage Analytics</h2>
          <p className="text-muted-foreground mt-1">Monitor platform wide storage consumption and quotas.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">System Capacity</CardTitle>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalUsed)}</div>
            <div className="flex items-center space-x-2 mt-2">
              <Progress value={usagePercent} className="flex-1 h-2" />
              <span className="text-xs text-muted-foreground">{usagePercent.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              of {formatBytes(totalLimit)} allocated
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Growth (30d)</CardTitle>
            <Activity className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              +{formatBytes(growthTrend[growthTrend.length - 1]?.totalBytes || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              New data acquired this month
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Data</CardTitle>
            <CloudLightning className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">{formatBytes(activeFilesBytes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently in use by users
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Trashed Data</CardTitle>
            <Trash2 className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">{formatBytes(trashedFilesBytes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending permanent deletion
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="col-span-1 md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Storage Growth Trend</CardTitle>
            <CardDescription>Cumulative storage usage over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <StorageGrowthChart data={growthTrend} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-emerald-500">
          <CardHeader>
            <CardTitle>File Types Breakdown</CardTitle>
            <CardDescription>Storage consumed by different file types</CardDescription>
          </CardHeader>
          <CardContent>
            <StorageBreakdownChart data={breakdown} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-blue-500">
          <CardHeader>
            <CardTitle>Files Status Overview</CardTitle>
            <CardDescription>Active vs Trashed files storage</CardDescription>
          </CardHeader>
          <CardContent>
            <FilesStatusChart data={filesStatus} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Top Volume Users</CardTitle>
            <CardDescription>Users consuming the highest amount of storage</CardDescription>
          </CardHeader>
          <CardContent>
            <TopUsersChart data={topUsers} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}