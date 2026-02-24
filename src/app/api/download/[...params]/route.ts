import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadFromTelegram, TelegramDownloadError } from "@/lib/telegram/download";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  try {
    // params[0] = file ID, params[1] = optional filename (for clean URLs)
    const { params: segments } = await params;
    const id = segments[0];

    if (!id) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch file record
    const { data: file, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Forward Range header so video seeking and resumable downloads work
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
      "Content-Type": finalContentType,
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    };

    // Forward size headers so browsers can show download progress and seek videos
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
      const status = error.statusCode === 404 || error.statusCode === 410 ? 404 : 502;
      const msg = status === 404 ? "File not found on storage" : "Storage service error";
      return NextResponse.json({ error: msg }, { status });
    }
    console.error("Download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
