import { NextRequest, NextResponse } from "next/server";
import { BackendUploadError, uploadToBackend } from "@/lib/telegram/upload";
import { createClient } from "@/lib/supabase/server";
import { resolveUploadThumbnail } from "@/lib/telegram/upload-thumbnail";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

// Configure route to handle large file uploads
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folderId = formData.get("folder_id") as string | null;
    const userId = formData.get("user_id") as string | null;
    const guestSessionId = formData.get("guest_session_id") as string | null;
    const fileHash = formData.get("file_hash") as string | null;
    const clientThumbnail = formData.get("thumbnail") as string | null;

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

    // Determine storage type: authenticated users with connected Telegram use 'user' storage
    const supabase = await createClient();
    let storageType = "bot";
    if (userId) {
      const { data: profile } = await supabase
        .from("users")
        .select("telegram_connected")
        .eq("id", userId)
        .single();
      if (profile?.telegram_connected) {
        storageType = "user";
      }
    }

    // Stream the File directly to TDLib service — no ArrayBuffer conversion
    const telegramResult = await uploadToBackend(
      file,
      file.name,
      file.type || "application/octet-stream",
      {
        userId,
        guestSessionId,
        folderId,
        storageType,
      }
    );

    // Insert file record into Supabase now that we have the Telegram IDs
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
        file_hash: fileHash || null,
        storage_type: telegramResult.storage_type || storageType,
        telegram_chat_id: telegramResult.chat_id || null,
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

    // Generate thumbnail for image/video files (non-fatal)
    await resolveUploadThumbnail(supabase, fileRecord, {
      storageType,
      userId,
      clientThumbnail,
      logLabel: file.name,
    });

    // If backend reported session_expired, confirm with status endpoint first.
    // This avoids false disconnects from temporary TDLib activation errors.
    if (telegramResult.session_expired && userId) {
      let confirmedDisconnected = false;

      try {
        const verifyResponse = await fetch(
          `${BACKEND_URL}/api/telegram/status/${encodeURIComponent(userId)}`,
          { headers: { "X-API-Key": API_KEY }, signal: AbortSignal.timeout(5000) },
        );

        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          confirmedDisconnected = !verifyData.connected;
        }
      } catch {
        // Keep DB state unchanged if we cannot verify.
      }

      if (confirmedDisconnected) {
        console.warn(`[Upload] Telegram session expired for user ${userId}, marking disconnected`);
        await supabase
          .from("users")
          .update({
            telegram_connected: false,
            telegram_phone: null,
            telegram_user_id: null,
            telegram_connected_at: null,
          })
          .eq("id", userId);
      } else {
        console.warn(`[Upload] session_expired flag for ${userId} was not confirmed by status check; preserving DB connection state`);
      }
    }

    return NextResponse.json({ file: fileRecord }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);

    if (error instanceof BackendUploadError) {
      if (error.status === 429) {
        const retryAfter = error.retryAfter ?? 30;
        return NextResponse.json(
          { error: error.message, retry_after: retryAfter },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfter) },
          },
        );
      }

      const status = error.status >= 400 && error.status < 600 ? error.status : 502;
      return NextResponse.json({ error: error.message }, { status });
    }

    const errorMessage = error instanceof Error ? error.message : "Upload failed";
    if (errorMessage.toLowerCase().includes("formdata")) {
      return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
