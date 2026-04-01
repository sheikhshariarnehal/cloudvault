import { NextResponse } from "next/server";

import { tdlibPost } from "@/lib/admin/tdlib-proxy";

export async function POST() {
  try {
    const result = await tdlibPost("/api/admin/tdlib/optimize");
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to optimize TDLib storage" },
      { status: 500 }
    );
  }
}
