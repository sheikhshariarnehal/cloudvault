import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "cloudvault";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

let _client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

/** Upload a thumbnail image to R2. Returns the public URL. */
export async function uploadThumbnail(
  fileId: string,
  buffer: Buffer | Uint8Array,
  contentType: string = "image/jpeg",
): Promise<string> {
  const key = `thumbnails/${fileId}.jpg`;
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return getThumbnailUrl(fileId);
}

/** Get the public R2 URL for a thumbnail. */
export function getThumbnailUrl(fileId: string): string {
  return `${R2_PUBLIC_URL}/thumbnails/${fileId}.jpg`;
}

/** Delete a thumbnail from R2. */
export async function deleteThumbnail(fileId: string): Promise<void> {
  const key = `thumbnails/${fileId}.jpg`;
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

/** Check if R2 is configured (all required env vars present). */
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_PUBLIC_URL);
}
