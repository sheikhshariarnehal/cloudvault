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

// POST - Revoke (deactivate) a shared link
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const { linkId } = await request.json();

    if (!linkId) {
      return NextResponse.json({ error: "Link ID required" }, { status: 400 });
    }

    // Determine user identity
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

    if (!userId && guestSessionId) {
      const { data: guestUser } = await supabase
        .from("users")
        .select("id")
        .eq("guest_session_id", guestSessionId)
        .single();
      userId = guestUser?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Verify ownership and deactivate
    const { data: link, error: fetchError } = await supabase
      .from("shared_links")
      .select("id, created_by")
      .eq("id", linkId)
      .single();

    if (fetchError || !link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (link.created_by !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from("shared_links")
      .update({ is_active: false })
      .eq("id", linkId);

    if (updateError) {
      console.error("Failed to revoke link:", updateError);
      return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Share revoke API error:", error);
    return NextResponse.json({ error: "Failed to revoke share link" }, { status: 500 });
  }
}
