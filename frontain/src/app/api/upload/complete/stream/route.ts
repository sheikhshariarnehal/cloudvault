import { NextRequest } from "next/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";

/**
 * GET /api/upload/complete/stream?jobId=...
 * Proxies SSE chunked-upload completion status from TDLib service.
 */
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing jobId" }), { status: 400 });
  }

  const response = await fetch(
    `${BACKEND_URL}/api/chunked-upload/complete-stream?jobId=${encodeURIComponent(jobId)}`,
    {
      method: "GET",
      headers: {
        "X-API-Key": API_KEY,
        Accept: "text/event-stream",
      },
    }
  );

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Connection: "keep-alive",
    },
  });
}