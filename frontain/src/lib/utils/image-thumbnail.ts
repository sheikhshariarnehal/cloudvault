/**
 * Extract a thumbnail from an image file using the browser's
 * built-in Image element and Canvas API.
 *
 * Scales down the image to fit within maxWidth and maxHeight.
 * Returns a Blob suitable for uploading to R2.
 */
export async function extractImageThumbnail(
  file: File,
  maxWidth = 320,
  maxHeight = 320,
): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;

  return new Promise<Blob | null>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };

    // Timeout: give up after 8 seconds
    const timer = setTimeout(fail, 8_000);

    img.onerror = fail;
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      try {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) {
          cleanup();
          resolve(null);
          return;
        }

        const scale = Math.min(1, maxWidth / iw, maxHeight / ih);
        const cw = Math.round(iw * scale);
        const ch = Math.round(ih * scale);

        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, cw, ch);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          "image/jpeg",
          0.8,
        );
      } catch {
        cleanup();
        resolve(null);
      }
    };

    img.src = url;
  });
}
