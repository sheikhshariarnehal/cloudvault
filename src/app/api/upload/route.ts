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
