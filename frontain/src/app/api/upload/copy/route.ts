import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload/copy
 * Create a new file record in Supabase that points to the same Telegram
 * file as an existing record. Used by content-hash dedup when a file with
 * the same content but different name/folder is uploaded.
 *
 * This avoids re-uploading the same bytes to Telegram — we just create a
 * new metadata row pointing to the same telegram_file_id / message_id.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceFileId, newName, folderId, userId, guestSessionId, fileHash } = body;

    if (!sourceFileId || !newName) {
      return NextResponse.json(
        { error: "Missing sourceFileId or newName" },
        { status: 400 }
      );
    }
    if (!userId && !guestSessionId) {
      return NextResponse.json(
        { error: "User ID or Guest Session ID required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch the source file to copy its Telegram references
    const { data: source, error: fetchError } = await supabase
      .from("files")
      .select()
      .eq("id", sourceFileId)
      .single();

    if (fetchError || !source) {
      return NextResponse.json(
        { error: "Source file not found" },
        { status: 404 }
      );
    }

    // Create a new record sharing the same Telegram storage
    const { data: newFile, error: insertError } = await supabase
      .from("files")
      .insert({
        user_id: userId || null,
        guest_session_id: guestSessionId || null,
        folder_id: folderId || null,
        name: newName,
        original_name: newName,
        mime_type: source.mime_type,
        size_bytes: source.size_bytes,
        telegram_file_id: source.telegram_file_id,
        telegram_message_id: source.telegram_message_id,
        tdlib_file_id: source.tdlib_file_id || null,
        thumbnail_url: source.thumbnail_url || null,
        file_hash: fileHash || source.file_hash || null,
      })
      .select()
      .single();

    if (insertError || !newFile) {
      console.error("[upload/copy] Insert error:", insertError);
      return NextResponse.json(
        { error: `Failed to create copy record: ${insertError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ file: newFile }, { status: 201 });
  } catch (error) {
    console.error("[upload/copy] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Copy failed" },
      { status: 500 }
    );
  }
}
