import { NextRequest, NextResponse } from "next/server";
import { uploadToTelegram } from "@/lib/telegram/upload";
import { createClient } from "@/lib/supabase/server";

// Configure route to handle large file uploads
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folderId = formData.get("folder_id") as string | null;
    const userId = formData.get("user_id") as string | null;
    const guestSessionId = formData.get("guest_session_id") as string | null;

    console.log("Upload request:", { 
      hasFile: !!file, 
      fileName: file?.name,
      fileSize: file?.size,
      userId, 
      guestSessionId 
    });

    if (!file) {
      console.error("Upload rejected: No file provided");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!userId && !guestSessionId) {
      console.error("Upload rejected: Missing user_id and guest_session_id");
      return NextResponse.json(
        { error: "User ID or Guest Session ID required" },
        { status: 400 }
      );
    }

    // Validate file size (2GB max)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds the 2GB limit" },
        { status: 400 }
      );
    }

    // Convert File to Buffer and upload via TDLib service
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const telegramResult = await uploadToTelegram(
      buffer,
      file.name,
      file.type || "application/octet-stream",
      {
        userId,
        guestSessionId,
        folderId,
      }
    );

    // Insert file record into Supabase now that we have the Telegram IDs
    const supabase = await createClient();
    const { data: fileRecord, error: dbError } = await supabase
      .from("files")
      .insert({
        user_id: userId || null,
        guest_session_id: guestSessionId || null,
        folder_id: folderId || null,
        name: file.name,
        original_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        telegram_file_id: telegramResult.file_id,
        telegram_message_id: telegramResult.message_id,
        tdlib_file_id: telegramResult.tdlib_file_id || null,
        thumbnail_url: telegramResult.thumbnail_data || null,
      })
      .select()
      .single();

    if (dbError || !fileRecord) {
      console.error("Supabase insert failed:", dbError);
      return NextResponse.json(
        { error: `Database record creation failed: ${dbError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ file: fileRecord }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
