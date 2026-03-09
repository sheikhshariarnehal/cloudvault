import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "";
const THUMBNAIL_TIMEOUT_MS = 15_000;

let _svc: ReturnType<typeof createSupabaseClient<Database>> | null = null;
function getServiceClient() {
  if (!_svc) {
    _svc = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _svc;
}

/**
 * Generate an R2 thumbnail for a file that was just uploaded to Telegram.
 * Calls the TDLib backend, which fetches the thumbnail from Telegram and
 * uploads it to R2.  The R2 URL is then persisted to Supabase.
 *
 * Non-fatal: returns the R2 URL on success, or null on any failure.
 */
export async function generateThumbnail(
  fileId: string,
  telegramMessageId: number,
): Promise<string | null> {
  if (!CHANNEL_ID || !API_KEY) return null;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), THUMBNAIL_TIMEOUT_MS);

    const resp = await fetch(`${BACKEND_URL}/api/thumbnail/from-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        message_id: telegramMessageId,
        file_id: fileId,
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) return null;

    const data = await resp.json();
    const r2Url: string | undefined = data.r2_url;
    if (!r2Url) return null;

    // Persist R2 URL to Supabase
    const { error } = await getServiceClient()
      .from("files")
      .update({ thumbnail_url: r2Url })
      .eq("id", fileId);

    if (error) {
      console.error("[Thumbnail] DB update failed:", error.message);
    }

    return r2Url;
  } catch (err) {
    console.error(
      "[Thumbnail] Generation failed (non-fatal):",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
