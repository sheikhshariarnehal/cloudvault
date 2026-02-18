import type { Database } from "./database.types";

// ── Telegram upload result ──────────────────────────────────
export interface UploadResult {
  file_id: string;
  message_id: number;
  thumbnail_url: string | null;
}

// ── Database row / insert aliases ───────────────────────────
export type DbFile = Database["public"]["Tables"]["files"]["Row"];
export type FileInsert = Database["public"]["Tables"]["files"]["Insert"];
export type DbUser = Database["public"]["Tables"]["users"]["Row"];
