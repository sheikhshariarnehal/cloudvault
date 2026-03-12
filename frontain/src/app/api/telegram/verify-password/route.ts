import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/telegram/verify-password
 * Submit the 2FA password for Telegram login.
 * Body: { password: string }
 * Returns: { status: "ready", telegramUserId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    let response: Response;
    try {
      response = await fetch(`${BACKEND_URL}/api/telegram/verify-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({ userId: user.id, password }),
      });
    } catch {
      console.error("[telegram/verify-password] Backend unreachable at", BACKEND_URL);
      return NextResponse.json(
        { error: "Telegram service is unavailable. Please try again later." },
        { status: 503 },
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Auth complete — update Supabase
    if (data.status === "ready") {
      await supabase
        .from("users")
        .update({
          telegram_connected: true,
          telegram_phone: data.phone || null,
          telegram_user_id: data.telegramUserId || null,
          telegram_connected_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[telegram/verify-password] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify password" },
      { status: 500 },
    );
  }
}
