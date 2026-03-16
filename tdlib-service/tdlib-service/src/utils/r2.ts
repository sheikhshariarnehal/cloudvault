import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// NOTE: env vars are read lazily (inside functions) because dotenv
// loads AFTER ESM static imports resolve — top-level reads would be empty.

let _client: S3Client | null = null;
let _clientAccountId: string | undefined;

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  // Re-create client if account ID changed (e.g. env reloaded)
  if (_client && _clientAccountId === accountId) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
  _clientAccountId = accountId;
  return _client;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_PUBLIC_URL
  );
}

export function getThumbnailUrl(fileId: string): string {
  return `${process.env.R2_PUBLIC_URL}/thumbnails/${fileId}.jpg`;
}

// UUID v4 pattern — only allow safe object keys
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Upload a thumbnail buffer to R2.
 * @param fileId  Supabase file UUID — used as the R2 object key
 * @param buffer  Raw image bytes
 * @param contentType  MIME type (default: image/jpeg)
 * @returns  Public R2 URL for the thumbnail
 */
export async function uploadThumbnailToR2(
  fileId: string,
  buffer: Buffer,
  contentType: string = "image/jpeg",
): Promise<string> {
  if (!UUID_RE.test(fileId)) {
    throw new Error(`Invalid file ID for R2 key: ${fileId}`);
  }
  if (!buffer.length) {
    throw new Error("Empty buffer — nothing to upload");
  }
  const bucketName = process.env.R2_BUCKET_NAME || "cloudvault";
  const key = `thumbnails/${fileId}.jpg`;
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return getThumbnailUrl(fileId);
}
