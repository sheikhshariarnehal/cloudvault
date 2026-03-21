import MissingEnvNotice from "@/components/admin/missing-env-notice";
import { 
  getOverviewStats,
  getStorageAlerts,
  getTopUserStats,
} from "@/lib/admin/queries";
import { isMissingAdminSupabaseEnvError } from "@/lib/supabase";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let stats;
  let alerts;
  let topUsers;

  try {
    [stats, alerts, topUsers] = await Promise.all([
      getOverviewStats(),
      getStorageAlerts(),
      getTopUserStats(),
    ]);
  } catch (error) {
    if (isMissingAdminSupabaseEnvError(error)) {
      return <MissingEnvNotice title="Dashboard data unavailable" />;
    }

    throw error;
  }

  return (
    <DashboardClient
      stats={stats}
      alerts={alerts}
      topUsers={topUsers}
    />
  );
}
