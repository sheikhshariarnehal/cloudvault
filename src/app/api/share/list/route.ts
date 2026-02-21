import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET - List all shared links created by the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceClient();

    // Determine user identity from auth or guest session
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await authClient.auth.getUser();
    const guestSessionId = cookieStore.get("guest_session_id")?.value;

    let userId = user?.id;

    // For guest users, look up their user record
    if (!userId && guestSessionId) {
      const { data: guestUser } = await supabase
        .from("users")
        .select("id")
        .eq("guest_session_id", guestSessionId)
        .single();
      userId = guestUser?.id;
    }

    if (!userId) {
      return NextResponse.json({ items: [] });
    }

    // Get all active shared links for this user
    const { data: links, error } = await supabase
      .from("shared_links")
      .select("*")
      .eq("created_by", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load shared links:", error);
      return NextResponse.json({ items: [] });
    }

    // Enrich with file/folder names
    const items = await Promise.all(
      (links || []).map(async (link) => {
        let file_name: string | undefined;
        let file_size: number | undefined;
        let folder_name: string | undefined;
        let folder_color: string | undefined;

        if (link.file_id) {
          const { data: file } = await supabase
            .from("files")
            .select("name, size_bytes")
            .eq("id", link.file_id)
            .single();
          file_name = file?.name || "Deleted file";
          file_size = file?.size_bytes;
        }

        if (link.folder_id) {
          const { data: folder } = await supabase
            .from("folders")
            .select("name, color")
            .eq("id", link.folder_id)
            .single();
          folder_name = folder?.name || "Deleted folder";
          folder_color = folder?.color;
        }

        return {
          id: link.id,
          token: link.token,
          is_active: link.is_active,
          created_at: link.created_at,
          file_id: link.file_id,
          folder_id: link.folder_id,
          download_count: link.download_count || 0,
          file_name,
          file_size,
          folder_name,
          folder_color,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Share list API error:", error);
    return NextResponse.json({ items: [] });
  }
}
