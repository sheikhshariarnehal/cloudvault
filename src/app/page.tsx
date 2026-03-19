import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, HardDrive, Files, Share2, UserPlus, Upload, Activity, UserCircle2 } from "lucide-react";
import OverviewChart from "@/components/dashboard/overview-chart";
import OverviewUploadVolumeChart from "@/components/dashboard/overview-upload-volume-chart";
import OverviewFileTypesChart from "@/components/dashboard/overview-file-types-chart";
import OverviewTopUploadersChart from "@/components/dashboard/overview-top-uploaders-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import MissingEnvNotice from "@/components/admin/missing-env-notice";
import { formatBytes } from "@/lib/admin/format";
import { getGrowthTrend, getOverviewInsights, getOverviewStats, getRecentUploads } from "@/lib/admin/queries";
import { isMissingAdminSupabaseEnvError } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let stats;
  let trend;
  let recentUploads;
  let insights;

  try {
    [stats, trend, recentUploads, insights] = await Promise.all([
      getOverviewStats(),
      getGrowthTrend(30),
      getRecentUploads(10),
      getOverviewInsights(30),
    ]);
  } catch (error) {
    if (isMissingAdminSupabaseEnvError(error)) {
      return <MissingEnvNotice title="Dashboard data unavailable" />;
    }

    throw error;
  }

  const dominantFileType = insights.fileTypeBreakdown30d[0];

  return (
    <div className="flex-1 space-y-6 lg:space-y-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard Overview</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <Files className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFiles.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active files</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.totalStorageBytes)}</div>
            <p className="text-xs text-muted-foreground">Total used storage</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Links</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeLinks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active shared links</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Users (7d)</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.newUsers7d.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">New accounts in the last 7 days</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uploads (7d)</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.uploads7d.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Files uploaded in the last 7 days</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Uploaders (30d)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.activeUploaders30d.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Unique users and guests uploading in 30 days</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Upload Size (30d)</CardTitle>
            <UserCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(insights.avgUploadSizeBytes30d)}</div>
            <p className="text-xs text-muted-foreground">Guest uploads: {insights.guestUploads30d.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-7">
        <Card className="h-full xl:col-span-4">
          <CardHeader>
            <CardTitle>Upload Volume (30d)</CardTitle>
            <CardDescription>
              {insights.uploads30d.toLocaleString()} files totaling {formatBytes(insights.uploadBytes30d)}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-0 sm:px-4">
            <OverviewUploadVolumeChart data={insights.uploadVolume30d} />
          </CardContent>
        </Card>

        <Card className="h-full xl:col-span-3">
          <CardHeader>
            <CardTitle>File Type Distribution (30d)</CardTitle>
            <CardDescription>
              Dominant category: {dominantFileType ? `${dominantFileType.name} (${formatBytes(dominantFileType.bytes)})` : "No data"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4 pt-0">
            <OverviewFileTypesChart data={insights.fileTypeBreakdown30d} />
            <div className="space-y-2.5">
              {insights.fileTypeBreakdown30d.slice(0, 4).map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium">{item.files.toLocaleString()} files</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-7">
        <div className="space-y-4 xl:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Storage Growth</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pt-0 sm:px-4">
              <OverviewChart data={trend} />
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Top Uploaders (30d)</CardTitle>
              <CardDescription>Highest upload volume by contributor over the last 30 days.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <OverviewTopUploadersChart data={insights.topUploaders30d} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-full xl:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Recent file uploads across the platform.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto pr-1 sm:pr-2">
            <RecentActivity items={recentUploads} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
