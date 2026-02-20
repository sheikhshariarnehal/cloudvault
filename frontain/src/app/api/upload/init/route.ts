import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload/init
 * Initialize a chunked upload session.
 * Proxies to TDLib service: POST /api/chunked-upload/init
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

    return NextResponse.json(data);
  } catch (error) {
    console.error("[upload/init] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Init failed" },
      { status: 500 }
    );
  }
}
