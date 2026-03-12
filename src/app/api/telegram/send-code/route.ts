import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";

/**
 * POST /api/telegram/send-code
 * Start Telegram login — sends SMS/Telegram code to the user's phone.
 * Body: { phone: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { phone } = await request.json();
    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    let response: Response;
    try {
      response = await fetch(`${BACKEND_URL}/api/telegram/send-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({ userId: user.id, phone }),
      });
    } catch {
      console.error("[telegram/send-code] Backend unreachable at", BACKEND_URL);
      return NextResponse.json(
        { error: "Telegram service is unavailable. Please try again later." },
        { status: 503 },
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[telegram/send-code] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send code" },
      { status: 500 },
    );
  }
}
