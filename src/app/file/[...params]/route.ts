import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { decodeFileToken } from "@/lib/utils";
import { createSignedToken, buildDirectUrl } from "@/lib/signed-url";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const PUBLIC_BACKEND_URL = process.env.NEXT_PUBLIC_TDLIB_CHUNK_URL || BACKEND_URL;
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

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
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges, Location",
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
    .select("id, telegram_file_id, telegram_message_id, mime_type, original_name, name, size_bytes")
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
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name || file.name)}"`,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    };

    if (file.size_bytes) {
      headers["Content-Length"] = String(file.size_bytes);
    }

    return new NextResponse(null, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 500, headers: corsHeaders() });
  }
}

/* ── GET — redirect to signed URL on TDLib service ───────────── */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  try {
    const { params: segments } = await params;
    const result = await resolveFile(segments);
    if ("error" in result) return result.error;
    const file = result.file;

    const fileName = file.original_name || file.name;

    // Create signed token (15 min TTL)
    const token = createSignedToken(
      {
        fid: file.telegram_file_id,
        mid: file.telegram_message_id || undefined,
        ct: file.mime_type || "application/octet-stream",
        fn: fileName,
        sz: file.size_bytes || undefined,
      },
      API_KEY,
    );

    const isDownload = request.nextUrl.searchParams.get("download") === "true";

    let directUrl = buildDirectUrl(
      PUBLIC_BACKEND_URL,
      token,
      file.telegram_file_id,
      fileName,
    );

    if (!isDownload) {
      directUrl += "&inline=true";
    } else {
      directUrl += "&inline=false";
    }

    // 302 redirect — the browser / fetch() follows automatically.
    // The TDLib service has Access-Control-Allow-Origin: * for cross-origin
    // fetch() calls from preview components.
    return NextResponse.redirect(directUrl, {
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error("[File Route] Error generating signed URL:", error);
    return NextResponse.json(
      { error: "Download failed" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
