/**
 * Extract a thumbnail frame from a video file using the browser's
 * built-in <video> element and Canvas API.
 *
 * Seeks to 1 second (or 0 if video is shorter) and captures a JPEG frame.
 * Returns a Blob suitable for uploading to R2.
 */
export async function extractVideoThumbnail(
  file: File,
  maxWidth = 320,
  maxHeight = 320,
): Promise<Blob | null> {
  // Only process video files
  if (!file.type.startsWith("video/")) return null;

  return new Promise<Blob | null>((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load(); // release resources
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };

    // Timeout: give up after 8 seconds
    const timer = setTimeout(fail, 8_000);

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("error", fail, { once: true });

    video.addEventListener(
      "loadeddata",
      () => {
        // Seek to 1s or start if very short
        video.currentTime = Math.min(1, video.duration || 0);
      },
      { once: true },
    );

    video.addEventListener(
      "seeked",
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        try {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) {
            cleanup();
            resolve(null);
            return;
          }

          // Scale down to fit within maxWidth × maxHeight
          const scale = Math.min(1, maxWidth / vw, maxHeight / vh);
          const cw = Math.round(vw * scale);
          const ch = Math.round(vh * scale);

          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            cleanup();
            resolve(null);
            return;
          }

          ctx.drawImage(video, 0, 0, cw, ch);
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
      },
      { once: true },
    );

    video.src = url;
  });
}
