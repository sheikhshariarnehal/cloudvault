import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

/**
 * POST /api/download/cancel
 * Body: { telegramFileId: string }
 *
 * Proxies a cancel request to the TDLib backend, which calls
 * cancelDownloadFile so Telegram stops sending data.
 */
export async function POST(req: NextRequest) {
  try {
    const { telegramFileId } = (await req.json()) as { telegramFileId?: string };
    if (!telegramFileId) {
      return NextResponse.json({ error: "telegramFileId required" }, { status: 400 });
    }

    const res = await fetch(
      `${BACKEND_URL}/api/download/cancel/${encodeURIComponent(telegramFileId)}`,
      {
        method: "POST",
        headers: { "x-api-key": API_KEY },
      },
    );

    const body = await res.json().catch(() => ({ ok: res.ok }));
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    console.error("[Cancel API]", err);
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }
}
