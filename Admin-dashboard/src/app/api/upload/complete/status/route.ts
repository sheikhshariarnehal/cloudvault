import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/upload/complete/status?jobId=...
 * Proxies async complete job status from TDLib service.
 */
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const response = await fetch(
      `${BACKEND_URL}/api/chunked-upload/complete-status?jobId=${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY,
        },
      }
    );

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[upload/complete/status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}
