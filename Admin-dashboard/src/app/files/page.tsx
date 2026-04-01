import { FilesTable } from "@/components/files/files-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "lucide-react";
import MissingEnvNotice from "@/components/admin/missing-env-notice";
import { getFiles } from "@/lib/admin/queries";
import { isMissingAdminSupabaseEnvError } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  let files;

  try {
    files = await getFiles(150);
  } catch (error) {
    if (isMissingAdminSupabaseEnvError(error)) {
      return <MissingEnvNotice title="Files data unavailable" />;
    }

    throw error;
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Files Management</h2>
          <p className="text-muted-foreground">Monitor platform files, handle abuse, and review storage.</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search filenames or owners..."
            className="pl-8"
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      <FilesTable files={files} />
    </div>
  );
}
