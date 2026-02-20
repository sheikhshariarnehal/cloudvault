import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/thumbnail/[id]
 *
 * Serves the stored thumbnail_url (base64 data-URI) for a file as an actual
 * image response with aggressive caching.  This avoids:
 *   1. Including giant base64 blobs in the file-list JSON payload
 *   2. Downloading the full-size file from Telegram just for a grid preview
 *
 * Responds with the decoded image bytes + proper Content-Type, or 404.
 */
export const dynamic = "force-dynamic";

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
      .select("thumbnail_url")
      .eq("id", id)
      .single();

    if (error || !file || !file.thumbnail_url) {
      return new NextResponse(null, { status: 404 });
    }

    const dataUri = file.thumbnail_url as string;

    // Parse the data URI: data:<mime>;base64,<data>
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        // Cache aggressively — thumbnails don't change
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
