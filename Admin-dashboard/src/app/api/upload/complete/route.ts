import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUploadThumbnail } from "@/lib/telegram/upload-thumbnail";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — Telegram upload can be slow for large files

/**
 * POST /api/upload/complete
 * Tell TDLib service to assemble chunks and upload to Telegram,
 * then create the Supabase file record.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      uploadId,
      fileName,
      fileSize,
      mimeType,
      userId,
      guestSessionId,
      folderId,
      fileHash,
      thumbnail: clientThumbnail,
      async: asyncMode,
    } = body;

    if (!uploadId) {
      return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });
    }

    if (!userId && !guestSessionId) {
      return NextResponse.json(
        { error: "User ID or Guest Session ID required" },
        { status: 400 }
      );
    }

    // Async mode: start Telegram upload job and return quickly.
    if (asyncMode) {
      const startRes = await fetch(`${BACKEND_URL}/api/chunked-upload/complete-start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({ uploadId }),
      });

      const startData = await startRes.json().catch(() => ({}));
      return NextResponse.json(startData, { status: startRes.status });
    }

    // Tell TDLib service to assemble and upload
    const response = await fetch(`${BACKEND_URL}/api/chunked-upload/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify({ uploadId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Forward rate-limit info
      if (response.status === 429) {
        return NextResponse.json(errorData, {
          status: 429,
          headers: { "Retry-After": response.headers.get("Retry-After") || "30" },
        });
      }

      return NextResponse.json(
        { error: errorData.error || `Backend returned ${response.status}` },
        { status: response.status }
      );
    }

    const telegramResult = await response.json();

    // Insert file record into Supabase
    const supabase = await createClient();
    const { data: fileRecord, error: dbError } = await supabase
      .from("files")
      .insert({
        user_id: userId || null,
        guest_session_id: guestSessionId || null,
        folder_id: folderId || null,
        name: fileName,
        original_name: fileName,
        mime_type: mimeType || "application/octet-stream",
        size_bytes: fileSize,
        telegram_file_id: telegramResult.file_id,
        telegram_message_id: telegramResult.message_id,
        tdlib_file_id: telegramResult.tdlib_file_id || null,
        thumbnail_url: telegramResult.thumbnail_data || null,
        file_hash: fileHash || null,
        storage_type: telegramResult.storage_type || "bot",
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

    // Generate thumbnail in background (non-fatal)
    void resolveUploadThumbnail(supabase, fileRecord, {
      storageType: telegramResult.storage_type || "bot",
      userId,
      clientThumbnail,
      logLabel: fileName,
    }).catch((thumbErr) => {
      console.warn("[upload/complete] Background thumbnail generation failed:", thumbErr);
    });

    // If the backend detected that the user's Telegram session expired,
    // update DB so the user is informed and can reconnect.
    if (telegramResult.session_expired && userId) {
      console.warn(`[upload/complete] Telegram session expired for user ${userId}, marking disconnected`);
      await supabase
        .from("users")
        .update({
          telegram_connected: false,
          telegram_phone: null,
          telegram_user_id: null,
          telegram_connected_at: null,
        })
        .eq("id", userId);
    }

    return NextResponse.json({ file: fileRecord }, { status: 201 });
  } catch (error) {
    console.error("[upload/complete] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Complete failed" },
      { status: 500 }
    );
  }
}
