import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSignedToken, buildDirectUrl } from "@/lib/signed-url";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const PUBLIC_BACKEND_URL = process.env.NEXT_PUBLIC_TDLIB_CHUNK_URL || BACKEND_URL;
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

/**
 * GET /api/download/:id/:filename?
 *
 * Auth-scoped download route. Instead of proxying the full file through
 * Vercel, we authenticate the user, look up the file in Supabase,
 * then redirect to a signed URL on the TDLib service so the browser
 * fetches the data directly from DigitalOcean (zero Vercel bandwidth).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  try {
    const { params: segments } = await params;
    const id = segments[0];

    if (!id) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: file, error } = await supabase
      .from("files")
      .select("id, telegram_file_id, telegram_message_id, mime_type, original_name, name, size_bytes")
      .eq("id", id)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Create signed token (15 min TTL)
    const token = createSignedToken(
      {
        fid: file.telegram_file_id,
        mid: file.telegram_message_id || undefined,
        ct: file.mime_type || "application/octet-stream",
        fn: file.original_name || file.name,
        sz: file.size_bytes || undefined,
      },
      API_KEY,
    );

    const isDownload = request.nextUrl.searchParams.get("download") === "true";

    let directUrl = buildDirectUrl(
      PUBLIC_BACKEND_URL,
      token,
      file.telegram_file_id,
      file.original_name || file.name,
    );

    if (!isDownload) {
      directUrl += "&inline=true";
    } else {
      directUrl += "&inline=false";
    }

    // 302 redirect — the browser fetches the file directly from DO
    return NextResponse.redirect(directUrl);
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
