import { NextResponse } from "next/server";

import { tdlibPost } from "@/lib/admin/tdlib-proxy";

export async function POST() {
  try {
    const result = await tdlibPost("/api/admin/storage/cleanup");
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clean up storage" },
      { status: 500 }
    );
  }
}
