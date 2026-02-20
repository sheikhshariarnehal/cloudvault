import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload/dedup
 * Check if a file with the same SHA-256 hash already exists.
 * If it does, create a new file record pointing to the same Telegram message
 * (instant "upload" — no data transferred to Telegram).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileHash, fileName, fileSize, mimeType, userId, guestSessionId, folderId } = body;

    if (!fileHash) {
      return NextResponse.json({ error: "Missing fileHash" }, { status: 400 });
    }
    if (!userId && !guestSessionId) {
      return NextResponse.json(
        { error: "User ID or Guest Session ID required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Look for any non-trashed file with the same hash (global dedup)
    const { data: existing, error: lookupError } = await supabase
      .from("files")
      .select()
      .eq("file_hash", fileHash)
      .eq("is_trashed", false)
      .limit(1)
      .single();

    if (lookupError || !existing) {
      // No match — caller should proceed with normal upload
      return NextResponse.json({ duplicate: false });
    }

    // Match found — create a new file record reusing the same Telegram pointers
    const { data: fileRecord, error: insertError } = await supabase
      .from("files")
      .insert({
        user_id: userId || null,
        guest_session_id: guestSessionId || null,
        folder_id: folderId || null,
        name: fileName,
        original_name: fileName,
        mime_type: mimeType || existing.mime_type,
        size_bytes: fileSize ?? existing.size_bytes,
        telegram_file_id: existing.telegram_file_id,
        telegram_message_id: existing.telegram_message_id,
        tdlib_file_id: existing.tdlib_file_id || null,
        thumbnail_url: existing.thumbnail_url || null,
        file_hash: fileHash,
      })
      .select()
      .single();

    if (insertError || !fileRecord) {
      console.error("[dedup] Insert failed:", insertError);
      return NextResponse.json(
        { error: `Database insert failed: ${insertError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ duplicate: true, file: fileRecord }, { status: 201 });
  } catch (error) {
    console.error("[dedup] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dedup check failed" },
      { status: 500 }
    );
  }
}
