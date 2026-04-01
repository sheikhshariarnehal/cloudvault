import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createSignedToken, buildDirectUrl } from "@/lib/signed-url";
import { decodeFileToken } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

/**
 * Service-role Supabase client — bypasses RLS so guest users
 * and all session types can retrieve file records for signed URLs.
 * This matches the same model used by /file/[...params]/route.ts.
 */
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * The public BACKEND_URL that the browser can reach.
 * In production this is the DigitalOcean app's public URL.
 * Falls back to TDLIB_SERVICE_URL (which works for dev since both are localhost).
 */
const PUBLIC_BACKEND_URL = process.env.NEXT_PUBLIC_TDLIB_CHUNK_URL || BACKEND_URL;

/**
 * GET /api/signed-url/:id
 *
 * Authenticate the user, look up the file in Supabase, then return a
 * short-lived signed URL pointing directly at the TDLib service.
 *
 * Query params:
 *   ?download=true  — sets Content-Disposition to attachment
 *
 * The signed token embeds: telegram_file_id, message_id, mime_type,
 * filename, file_size, and a 15-minute expiry with HMAC-SHA256.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 });
    }

    // If the id is already a raw UUID, use it directly.
    // decodeFileToken silently corrupts UUIDs (replaces '-' with '+'),
    // so we must guard against applying it to an already-decoded value.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const fileId = UUID_RE.test(id) ? id : decodeFileToken(id);

    const supabase = getServiceClient();

    // Fetch file record
    const { data: file, error } = await supabase
      .from("files")
      .select("id, telegram_file_id, telegram_message_id, mime_type, original_name, name, size_bytes, storage_type, user_id")
      .eq("id", fileId)
      .single();

    if (error || !file) {
      console.error("[signed-url] Supabase lookup failed:", {
        fileId,
        error: error?.message || error,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      });
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Create the signed token (15 min TTL)
    const token = createSignedToken(
      {
        fid: file.telegram_file_id,
        mid: file.telegram_message_id || undefined,
        ct: file.mime_type || "application/octet-stream",
        fn: file.original_name || file.name,
        sz: file.size_bytes || undefined,
        st: file.storage_type || "bot",
        uid: file.storage_type === "user" ? (file.user_id || undefined) : undefined,
      },
      API_KEY,
    );

    // Build the direct URL to the TDLib service
    const directUrl = buildDirectUrl(
      PUBLIC_BACKEND_URL,
      token,
      file.telegram_file_id,
      file.original_name || file.name,
    );

    const isDownload = request.nextUrl.searchParams.get("download") === "true";

    // Build the status-polling URL for the frontend to track backend progress
    const statusUrl = `${PUBLIC_BACKEND_URL}/api/dl/status/${encodeURIComponent(file.telegram_file_id)}?sig=${encodeURIComponent(token)}`;

    return NextResponse.json({
      url: isDownload ? `${directUrl}&inline=false` : directUrl,
      statusUrl,
      telegramFileId: file.telegram_file_id,
      expiresIn: 900, // 15 minutes
    });
  } catch (error) {
    console.error("[signed-url] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate URL" },
      { status: 500 },
    );
  }
}
