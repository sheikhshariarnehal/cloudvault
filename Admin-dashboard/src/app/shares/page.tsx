import { SharesTable } from "@/components/shares/shares-table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import MissingEnvNotice from "@/components/admin/missing-env-notice";
import { getShares } from "@/lib/admin/queries";
import { isMissingAdminSupabaseEnvError } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function SharesPage() {
  let shares;

  try {
    shares = await getShares(100);
  } catch (error) {
    if (isMissingAdminSupabaseEnvError(error)) {
      return <MissingEnvNotice title="Shares data unavailable" />;
    }

    throw error;
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Shared Links</h2>
          <p className="text-muted-foreground">Manage active file and folder shares.</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by filename or owner..."
            className="pl-8"
          />
        </div>
      </div>

      <SharesTable shares={shares} />
    </div>
  );
}
