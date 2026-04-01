import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function getSafeRedirectTarget(origin: string, next: string | null, fallback: string) {
  if (!next) {
    return fallback;
  }

  try {
    const nextUrl = new URL(next, origin);
    if (nextUrl.origin !== origin) {
      return fallback;
    }

    return `${nextUrl.pathname}${nextUrl.search}`;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = getSafeRedirectTarget(origin, searchParams.get("next"), "/auth/reset-password");

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=password_recovery_failed`);
}