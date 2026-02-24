import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { downloadFromTelegram, TelegramDownloadError } from "@/lib/telegram/download";
import { decodeFileToken } from "@/lib/utils";

// Allow up to 5 minutes — TDLib must fully download the file from Telegram before streaming
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Service-role Supabase client — bypasses RLS so external viewers
 * (Office Online, Google Docs) can fetch files without user cookies.
 */
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** CORS + cache headers shared by every response from this route. */
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers": "Content-Length, Content-Type, Content-Disposition",
  };
}

/** Resolve token → file record (or error response). */
async function resolveFile(segments: string[]) {
  const token = segments[0];
  if (!token) {
    return { error: NextResponse.json({ error: "File token required" }, { status: 400, headers: corsHeaders() }) };
  }

  let id: string;
  try {
    id = decodeFileToken(token);
  } catch {
    return { error: NextResponse.json({ error: "Invalid file token" }, { status: 400, headers: corsHeaders() }) };
  }

  const supabase = getServiceClient();
  const { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !file) {
    return { error: NextResponse.json({ error: "File not found" }, { status: 404, headers: corsHeaders() }) };
  }

  return { file };
}

/* ── OPTIONS (CORS preflight) ────────────────────────────────── */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/* ── HEAD (required by Office Online / Google Docs) ──────────── */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  try {
    const { params: segments } = await params;
    const result = await resolveFile(segments);
    if ("error" in result) return result.error;
    const file = result.file;

    const headers: Record<string, string> = {
      ...corsHeaders(),
      "Content-Type": file.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name)}"`,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    };

    if (file.size) {
      headers["Content-Length"] = String(file.size);
    }

    return new NextResponse(null, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 500, headers: corsHeaders() });
  }
}

/* ── GET (stream the file) ───────────────────────────────────── */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  try {
    const { params: segments } = await params;
    const result = await resolveFile(segments);
    if ("error" in result) return result.error;
    const file = result.file;

    // Forward Range header so video seeking works through this public route
    const rangeHeader = request.headers.get("range") ?? undefined;

    // Download from Telegram via TDLib service using the remote file_id
    const { stream, contentType, contentLength, contentRange, status } =
      await downloadFromTelegram(
        file.telegram_file_id,
        file.mime_type || "application/octet-stream",
        file.telegram_message_id,
        { rangeHeader },
      );

    const isDownload =
      request.nextUrl.searchParams.get("download") === "true";

    // Use the mime_type from the database instead of Telegram's content-type
    const finalContentType = file.mime_type || contentType;

    const headers: Record<string, string> = {
      ...corsHeaders(),
      "Content-Type": finalContentType,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    };

    // Forward size / range headers so browsers and Office Online can seek/stream
    if (contentLength) headers["Content-Length"] = String(contentLength);
    if (contentRange)  headers["Content-Range"]  = contentRange;

    if (isDownload) {
      headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(file.original_name)}"`;
    } else {
      headers["Content-Disposition"] = `inline; filename="${encodeURIComponent(file.original_name)}"`;
    }

    // Return 206 for Range responses, 200 otherwise
    return new NextResponse(stream, { status, headers });
  } catch (error) {
    if (error instanceof TelegramDownloadError) {
      console.error(`[File Route] TDLib download error (HTTP ${error.statusCode}):`, error.message);
      const status = error.statusCode === 404 || error.statusCode === 410 ? 404 : 502;
      const msg = status === 404
        ? "File not found on storage"
        : `Storage service error: ${error.message}`;
      return NextResponse.json({ error: msg }, { status, headers: corsHeaders() });
    }
    console.error("[File Route] Unexpected download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500, headers: corsHeaders() });
  }
}
