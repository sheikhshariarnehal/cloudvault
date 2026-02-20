import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

// Public URL of TDLib service for direct browser → TDLib chunk uploads
const PUBLIC_BACKEND_URL = process.env.NEXT_PUBLIC_TDLIB_CHUNK_URL || BACKEND_URL;

export const dynamic = "force-dynamic";

/**
 * POST /api/upload/init
 * Initialize a chunked upload session.
 * Proxies to TDLib service: POST /api/chunked-upload/init
 * Returns direct chunkEndpoint URL so browser can skip Vercel proxy.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/chunked-upload/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Return direct backend URL so client can bypass Vercel for chunks
    // Strip trailing slash to avoid double-slash in URL
    const baseUrl = PUBLIC_BACKEND_URL.replace(/\/+$/, "");
    return NextResponse.json({
      ...data,
      chunkEndpoint: `${baseUrl}/api/chunked-upload/chunk`,
    });
  } catch (error) {
    console.error("[upload/init] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Init failed" },
      { status: 500 }
    );
  }
}
