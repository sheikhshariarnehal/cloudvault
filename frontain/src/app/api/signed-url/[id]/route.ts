import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSignedToken, buildDirectUrl } from "@/lib/signed-url";
import { decodeFileToken } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

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

    // Decode if it's a base64url token (from /file/ routes), otherwise treat as UUID
    let fileId: string;
    try {
      fileId = decodeFileToken(id);
    } catch {
      fileId = id; // already a raw UUID
    }

    const supabase = await createClient();

    // Fetch file record
    const { data: file, error } = await supabase
      .from("files")
      .select("id, telegram_file_id, telegram_message_id, mime_type, original_name, name, size_bytes")
      .eq("id", fileId)
      .single();

    if (error || !file) {
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

    return NextResponse.json({
      url: isDownload ? `${directUrl}&inline=false` : directUrl,
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
