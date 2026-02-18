import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { downloadFromTelegram, TelegramDownloadError } from "@/lib/telegram/download";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET - Resolve a share token and return file info or download the file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getServiceClient();

    // Look up the share link
    const { data: shareLink, error: linkError } = await supabase
      .from("shared_links")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (linkError || !shareLink) {
      return NextResponse.json(
        { error: "Share link not found or expired" },
        { status: 404 }
      );
    }

    // Check if link is expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Share link has expired" },
        { status: 410 }
      );
    }

    // Check max downloads
    if (
      shareLink.max_downloads &&
      shareLink.download_count >= shareLink.max_downloads
    ) {
      return NextResponse.json(
        { error: "Download limit reached" },
        { status: 410 }
      );
    }

    // Get the shared file
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("id", shareLink.file_id)
      .single();

    if (fileError || !file) {
      return NextResponse.json(
        { error: "Shared file no longer exists" },
        { status: 404 }
      );
    }

    // Check if this is a download request
    const isDownload = request.nextUrl.searchParams.get("download") === "true";

    if (isDownload) {
      // Increment download count
      await supabase
        .from("shared_links")
        .update({ download_count: shareLink.download_count + 1 })
        .eq("id", shareLink.id);

      // Download from Telegram via TDLib service using the remote file_id
      const { stream } = await downloadFromTelegram(
        file.telegram_file_id,
        file.mime_type || "application/octet-stream"
      );

      return new NextResponse(stream, {
        headers: {
          "Content-Type": file.mime_type || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.original_name)}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Check if this is a preview/stream request (for images, videos, PDFs)
    const isPreview = request.nextUrl.searchParams.get("preview") === "true";

    if (isPreview) {
      const { stream } = await downloadFromTelegram(
        file.telegram_file_id,
        file.mime_type || "application/octet-stream"
      );

      return new NextResponse(stream, {
        headers: {
          "Content-Type": file.mime_type || "application/octet-stream",
          "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name)}"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    // Return file metadata (for the share page to render)
    return NextResponse.json({
      file: {
        id: file.id,
        name: file.name,
        original_name: file.original_name,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        created_at: file.created_at,
      },
      shareLink: {
        token: shareLink.token,
        created_at: shareLink.created_at,
      },
    });
  } catch (error) {
    if (error instanceof TelegramDownloadError) {
      const status = error.statusCode === 404 || error.statusCode === 410 ? 404 : 502;
      const msg = status === 404 ? "File not found on storage" : "Storage service error";
      return NextResponse.json({ error: msg }, { status });
    }
    console.error("Share link error:", error);
    return NextResponse.json(
      { error: "Failed to process share link" },
      { status: 500 }
    );
  }
}
