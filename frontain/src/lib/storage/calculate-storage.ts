import { createClient } from "@/lib/supabase/client";

export async function calculateStorageUsed(
  userId: string | null,
  guestSessionId: string | null
): Promise<number> {
  const supabase = createClient();

  let query = supabase
    .from("files")
    .select("size_bytes")
    .eq("is_trashed", false);

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (guestSessionId) {
    query = query.eq("guest_session_id", guestSessionId);
  } else {
    return 0;
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error calculating storage:", error);
    return 0;
  }

  return data.reduce((total, file) => total + file.size_bytes, 0);
}

export function getStorageBreakdown(
  files: { mime_type: string; size_bytes: number }[]
): Record<string, number> {
  const breakdown: Record<string, number> = {
    photo: 0,
    video: 0,
    document: 0,
    other: 0,
  };

  for (const file of files) {
    if (file.mime_type.startsWith("image/")) {
      breakdown.photo += file.size_bytes;
    } else if (file.mime_type.startsWith("video/")) {
      breakdown.video += file.size_bytes;
    } else if (
      file.mime_type.includes("document") ||
      file.mime_type.includes("text") ||
      file.mime_type.includes("pdf") ||
      file.mime_type.includes("sheet") ||
      file.mime_type.includes("presentation")
    ) {
      breakdown.document += file.size_bytes;
    } else {
      breakdown.other += file.size_bytes;
    }
  }

  return breakdown;
}
