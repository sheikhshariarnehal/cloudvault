import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateThumbnail } from "@/lib/telegram/thumbnail";

/**
 * GET /api/thumbnail/[id]
 *
 * Serves the thumbnail for a file:
 *   1. If thumbnail_url is an R2 URL → 302 redirect (fast, no Vercel compute)
 *   2. If missing or legacy base64 → fetch from TDLib backend (uploads to R2) → update DB → redirect
 *   3. Fallback: serve legacy base64 inline
 */
export const dynamic = "force-dynamic";

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

function isR2Url(url: string): boolean {
  return R2_PUBLIC_URL ? url.startsWith(R2_PUBLIC_URL) : url.startsWith("https://") && url.includes(".r2.dev/");
}

function isBase64DataUri(url: string): boolean {
  return url.startsWith("data:");
}

function parseDataUri(dataUri: string): { contentType: string; buffer: Buffer } | null {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "File ID required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: file, error } = await supabase
      .from("files")
      .select("thumbnail_url, telegram_message_id, mime_type, storage_type, user_id, telegram_chat_id")
      .eq("id", id)
      .single();

    if (error || !file) {
      return new NextResponse(null, { status: 404 });
    }

    // ── Fast path: already an R2 URL → instant redirect ──
    if (file.thumbnail_url && isR2Url(file.thumbnail_url)) {
      return NextResponse.redirect(file.thumbnail_url, 302);
    }

    // ── Need to fetch from TDLib backend (handles R2 upload server-side) ──
    if (file.telegram_message_id) {
      const r2Url = await generateThumbnail(id, file.telegram_message_id, {
        storageType: file.storage_type || "bot",
        userId: file.user_id,
        chatId: file.telegram_chat_id,
      });
      if (r2Url) {
        return NextResponse.redirect(r2Url, 302);
      }
    }

    // Legacy base64 fallback (no message ID or backend failed)
    if (file.thumbnail_url && isBase64DataUri(file.thumbnail_url)) {
      const parsed = parseDataUri(file.thumbnail_url);
      if (parsed) {
        const body = new Uint8Array(parsed.buffer);
        return new NextResponse(body, {
          headers: {
            "Content-Type": parsed.contentType,
            "Content-Length": String(body.length),
            "Cache-Control": "public, max-age=604800, immutable",
          },
        });
      }
    }

    return new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

