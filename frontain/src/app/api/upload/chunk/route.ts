import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 1 minute per chunk

/**
 * POST /api/upload/chunk
 * Forward a single chunk to TDLib service.
 * Proxies to: POST /api/chunked-upload/chunk
 *
 * The request body is multipart/form-data with:
 *   - chunk: the file chunk blob
 *   - uploadId: session id
 *   - chunkIndex: 0-based index
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Forward the FormData to the TDLib service
    const response = await fetch(`${BACKEND_URL}/api/chunked-upload/chunk`, {
      method: "POST",
      headers: {
        "X-API-Key": API_KEY,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[upload/chunk] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chunk upload failed" },
      { status: 500 }
    );
  }
}
