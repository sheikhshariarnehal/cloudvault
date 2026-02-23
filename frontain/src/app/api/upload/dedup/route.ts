import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload/dedup
 * Check if a file with the same name already exists in the same folder
 * for the same user/session. If it does, skip the upload and return the
 * existing file record so the UI can mark it as a duplicate.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, userId, guestSessionId, folderId } = body;

    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName" }, { status: 400 });
    }
    if (!userId && !guestSessionId) {
      return NextResponse.json(
        { error: "User ID or Guest Session ID required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Build a query scoped to this user/session, same folder, same name
    let query = supabase
      .from("files")
      .select()
      .eq("name", fileName)
      .eq("is_trashed", false);

    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      query = query.eq("guest_session_id", guestSessionId);
    }

    if (folderId) {
      query = query.eq("folder_id", folderId);
    } else {
      query = query.is("folder_id", null);
    }

    const { data: existing, error: lookupError } = await query.limit(1).single();

    if (lookupError || !existing) {
      // No name collision in this folder — proceed with normal upload
      return NextResponse.json({ duplicate: false });
    }

    // Same-name file already exists in this folder — return it as-is
    return NextResponse.json({ duplicate: true, file: existing });
  } catch (error) {
    console.error("[dedup] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dedup check failed" },
      { status: 500 }
    );
  }
}
