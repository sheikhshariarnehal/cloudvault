import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUploadThumbnail } from "@/lib/telegram/upload-thumbnail";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/upload/finalize
 * Finalizes chunked upload after async Telegram send completes:
 * 1) fetches final Telegram payload by complete jobId
 * 2) inserts Supabase file record
 * 3) triggers thumbnail resolution in background
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      jobId,
      fileName,
      fileSize,
      mimeType,
      userId,
      guestSessionId,
      folderId,
      fileHash,
      thumbnail: clientThumbnail,
    } = body;

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    if (!userId && !guestSessionId) {
      return NextResponse.json(
        { error: "User ID or Guest Session ID required" },
        { status: 400 }
      );
    }

    const completeResultRes = await fetch(
      `${BACKEND_URL}/api/chunked-upload/complete-result?jobId=${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      }
    );

    const completeResult = await completeResultRes.json().catch(() => ({}));

    if (completeResultRes.status === 202) {
      return NextResponse.json(completeResult, { status: 202 });
    }

    if (!completeResultRes.ok) {
      const retryAfter = completeResultRes.headers.get("Retry-After");
      return NextResponse.json(completeResult, {
        status: completeResultRes.status,
        headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
      });
    }

    const supabase = await createClient();

    // Idempotency guard: if finalize is retried, return existing row.
    const { data: existing } = await supabase
      .from("files")
      .select("*")
      .eq("telegram_message_id", completeResult.message_id)
      .eq("user_id", userId || null)
      .eq("guest_session_id", guestSessionId || null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ file: existing }, { status: 200 });
    }

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
        telegram_file_id: completeResult.file_id,
        telegram_message_id: completeResult.message_id,
        tdlib_file_id: completeResult.tdlib_file_id || null,
        thumbnail_url: completeResult.thumbnail_data || null,
        file_hash: fileHash || null,
        storage_type: completeResult.storage_type || "bot",
        telegram_chat_id: completeResult.chat_id || null,
      })
      .select()
      .single();

    if (dbError || !fileRecord) {
      console.error("[upload/finalize] Supabase insert failed:", dbError);
      return NextResponse.json(
        { error: `Database record creation failed: ${dbError?.message}` },
        { status: 500 }
      );
    }

    void resolveUploadThumbnail(supabase, fileRecord, {
      storageType: completeResult.storage_type || "bot",
      userId,
      clientThumbnail,
      logLabel: fileName,
    }).catch((thumbErr) => {
      console.warn("[upload/finalize] Background thumbnail generation failed:", thumbErr);
    });

    if (completeResult.session_expired && userId) {
      console.warn(`[upload/finalize] Telegram session expired for user ${userId}, marking disconnected`);
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
    console.error("[upload/finalize] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Finalize failed" },
      { status: 500 }
    );
  }
}
