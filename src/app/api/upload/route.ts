import { NextRequest, NextResponse } from "next/server";

// Configure route to handle large file uploads
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const backendUrl = process.env.MTPROTO_BACKEND_URL;
    const apiKey = process.env.MTPROTO_API_KEY;

    if (!backendUrl || !apiKey) {
      return NextResponse.json(
        { error: "Backend not configured" },
        { status: 500 }
      );
    }

    // Forward the multipart form data directly to the Express backend
    const formData = await request.formData();

    // Pass through the x-upload-id header for SSE progress tracking
    const uploadId = request.headers.get("x-upload-id");

    const headers: Record<string, string> = {
      "X-API-Key": apiKey,
    };
    if (uploadId) headers["X-Upload-Id"] = uploadId;

    const response = await fetch(`${backendUrl}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Upload proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folderId = formData.get("folder_id") as string | null;
    const userId = formData.get("user_id") as string | null;
    const guestSessionId = formData.get("guest_session_id") as string | null;

    console.log("Upload request:", { 
      hasFile: !!file, 
      fileName: file?.name,
      fileSize: file?.size,
      userId, 
      guestSessionId 
    });

    if (!file) {
      console.error("Upload rejected: No file provided");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!userId && !guestSessionId) {
      console.error("Upload rejected: Missing user_id and guest_session_id");
      return NextResponse.json(
        { error: "User ID or Guest Session ID required" },
        { status: 400 }
      );
    }

    // Validate file size (2GB max)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds the 2GB limit" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Telegram
    const telegramResult = await uploadToTelegram(
      buffer,
      file.name,
      file.type || "application/octet-stream"
    );

    // Save file record to Supabase
    const supabase = await createClient();

    const fileRecord = {
      user_id: userId,
      guest_session_id: guestSessionId,
      folder_id: folderId || null,
      name: file.name,
      original_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      telegram_file_id: telegramResult.file_id,
      telegram_message_id: telegramResult.message_id,
      thumbnail_url: telegramResult.thumbnail_url,
    };

    const { data, error } = await supabase
      .from("files")
      .insert(fileRecord)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to save file record" },
        { status: 500 }
      );
    }

    // Update user storage
    if (userId) {
      await supabase.rpc("increment_storage", {
        user_id_param: userId,
        bytes_param: file.size,
      });
    }

    return NextResponse.json({ file: data }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
