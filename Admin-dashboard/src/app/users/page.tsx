import { UsersTable } from "@/components/users/users-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus } from "lucide-react";
import MissingEnvNotice from "@/components/admin/missing-env-notice";
import { getUsers } from "@/lib/admin/queries";
import { isMissingAdminSupabaseEnvError } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  let users;

  try {
    users = await getUsers(100);
  } catch (error) {
    if (isMissingAdminSupabaseEnvError(error)) {
      return <MissingEnvNotice title="Users data unavailable" />;
    }

    throw error;
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Users Management</h2>
          <p className="text-muted-foreground">Manage users, their storage limits, and access.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by email or name..."
            className="pl-8"
          />
        </div>
      </div>

      <UsersTable users={users} />
    </div>
  );
}
