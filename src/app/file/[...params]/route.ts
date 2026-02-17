import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadFromTelegram } from "@/lib/telegram/download";
import { decodeFileToken } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  try {
    // params[0] = encoded token, params[1+] = filename segments (cosmetic)
    const { params: segments } = await params;
    const token = segments[0];

    if (!token) {
      return NextResponse.json({ error: "File token required" }, { status: 400 });
    }

    // Decode the compact token back to a UUID
    let id: string;
    try {
      id = decodeFileToken(token);
    } catch {
      return NextResponse.json({ error: "Invalid file token" }, { status: 400 });
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

    // Download from Telegram
    const { stream, contentType } = await downloadFromTelegram(
      file.telegram_file_id
    );

    const isDownload =
      request.nextUrl.searchParams.get("download") === "true";

    // Use the mime_type from the database instead of Telegram's content-type
    const finalContentType = file.mime_type || contentType;

    const headers: HeadersInit = {
      "Content-Type": finalContentType,
      "Cache-Control": "private, max-age=3600",
    };

    if (isDownload) {
      headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(file.original_name)}"`;
    } else {
      headers["Content-Disposition"] = `inline; filename="${encodeURIComponent(file.original_name)}"`;
    }

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Download failed" },
      { status: 500 }
    );
  }
}
