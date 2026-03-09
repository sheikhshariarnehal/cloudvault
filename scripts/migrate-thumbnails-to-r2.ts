/**
 * Migration script: Move all base64 thumbnails from Supabase to Cloudflare R2.
 *
 * Reads base64 data-URIs stored in files.thumbnail_url, uploads them directly
 * to R2, then updates Supabase with the public R2 URL.
 *
 * Usage:  npx tsx scripts/migrate-thumbnails-to-r2.ts
 *
 * Requires environment variables (reads from ../.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ── Load .env.local ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "cloudvault";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// ── Validate env ──
const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY],
  ["R2_ACCOUNT_ID", R2_ACCOUNT_ID],
  ["R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID],
  ["R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY],
  ["R2_PUBLIC_URL", R2_PUBLIC_URL],
].filter(([, v]) => !v);

if (missing.length > 0) {
  console.error("Missing env vars:", missing.map(([k]) => k).join(", "));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

function parseDataUri(dataUri: string): { contentType: string; buffer: Buffer } | null {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}

async function uploadToR2(fileId: string, buffer: Buffer, contentType: string): Promise<string> {
  const key = `thumbnails/${fileId}.jpg`;
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${R2_PUBLIC_URL}/thumbnails/${fileId}.jpg`;
}

const BATCH_SIZE = 100;
const CONCURRENCY = 10;

async function migrate() {
  console.log("Starting thumbnail migration to R2...");
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  R2 bucket: ${R2_BUCKET_NAME}`);
  console.log(`  R2 public: ${R2_PUBLIC_URL}`);
  console.log();

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  // skipCursor advances past records that failed/skipped to prevent infinite loops
  let skipCursor = 0;

  while (true) {
    const { data: files, error } = await supabase
      .from("files")
      .select("id, thumbnail_url")
      .like("thumbnail_url", "data:%")
      .range(skipCursor, skipCursor + BATCH_SIZE - 1);

    if (error) {
      console.error("Query error:", error.message);
      break;
    }

    if (!files || files.length === 0) break;

    console.log(`Processing batch: ${files.length} files (cursor ${skipCursor})...`);

    let notMigratedThisBatch = 0;

    // Process in parallel with concurrency limit
    const chunks: typeof files[] = [];
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      chunks.push(files.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (file) => {
          const parsed = parseDataUri(file.thumbnail_url);
          if (!parsed) {
            skipped++;
            notMigratedThisBatch++;
            return;
          }

          const r2Url = await uploadToR2(file.id, parsed.buffer, parsed.contentType);

          const { error: updateErr } = await supabase
            .from("files")
            .update({ thumbnail_url: r2Url })
            .eq("id", file.id);

          if (updateErr) throw new Error(`DB update failed for ${file.id}: ${updateErr.message}`);
          migrated++;
        }),
      );

      for (const r of results) {
        if (r.status === "rejected") {
          failed++;
          notMigratedThisBatch++;
          console.error("  Error:", r.reason);
        }
      }
    }

    // Advance cursor past items that couldn't be migrated
    skipCursor += notMigratedThisBatch;

    // End of dataset
    if (files.length < BATCH_SIZE) break;
  }

  console.log();
  console.log("Migration complete!");
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);
}

migrate().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
