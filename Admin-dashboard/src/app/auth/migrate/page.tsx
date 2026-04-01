"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getGuestSessionData, clearGuestSession } from "@/lib/guest-session";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import NextImage from "next/image";

export default function MigratePage() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchGuestFiles = async () => {
      const guestData = getGuestSessionData();
      if (!guestData) {
        router.push("/auth/login");
        return;
      }

      const { count } = await supabase
        .from("files")
        .select("*", { count: "exact", head: true })
        .eq("guest_session_id", guestData.id)
        .eq("is_trashed", false);

      setFileCount(count || 0);
    };

    fetchGuestFiles();
  }, [router, supabase]);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const guestData = getGuestSessionData();
      if (!guestData) {
        router.push("/drive");
        return;
      }

      // Update all guest files to belong to the authenticated user
      const { error: filesError } = await supabase
        .from("files")
        .update({ user_id: user.id, guest_session_id: null })
        .eq("guest_session_id", guestData.id);

      if (filesError) throw filesError;

      // Update all guest folders
      const { error: foldersError } = await supabase
        .from("folders")
        .update({ user_id: user.id, guest_session_id: null })
        .eq("guest_session_id", guestData.id);

      if (foldersError) throw foldersError;

      clearGuestSession();
      router.push("/drive");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSkip = () => {
    clearGuestSession();
    router.push("/drive");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <NextImage src="/logo.webp" alt="CloudVault" width={52} height={52} className="mx-auto" />
        <h2 className="text-2xl font-bold">Migrate Guest Files</h2>
        <p className="text-muted-foreground">
          You have <strong>{fileCount} files</strong> from your guest session.
          Would you like to migrate them to your account?
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={handleMigrate}
            disabled={isMigrating || fileCount === 0}
          >
            {isMigrating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            {isMigrating ? "Migrating..." : "Migrate Files to My Account"}
          </Button>

          <Button variant="ghost" className="w-full" onClick={handleSkip}>
            Skip and Start Fresh
          </Button>
        </div>
      </div>
    </div>
  );
}
