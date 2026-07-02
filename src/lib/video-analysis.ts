/**
 * Video analysis utilities using the HTML5 <video> element.
 * Captures thumbnails at evenly-spaced timestamps and exposes metadata.
 */

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  /** Optional codec info from MediaSource.isTypeSupported, if available. */
  codecs: string | null;
}

export interface VideoFrame {
  index: number;
  time: number;
  dataUrl: string;
}

/**
 * Probe a video file for metadata using a hidden video element.
 */
export function probeVideo(
  file: File,
  onProgress?: (progress: number) => void
): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      onProgress?.(0.5);
    };
    video.oncanplay = () => {
      if (settled) return;
      settled = true;
      const meta: VideoMetadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        codecs: null,
      };
      onProgress?.(1);
      cleanup();
      resolve(meta);
    };
    video.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Video could not be loaded by the browser."));
    };
    // Safety timeout
    setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("Timed out probing video metadata."));
      }
    }, 15000);
  });
}

/**
 * Capture N thumbnails evenly distributed across the video duration.
 */
export async function captureFrames(
  file: File,
  count: number,
  maxWidth: number,
  onProgress?: (done: number, total: number) => void
): Promise<VideoFrame[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.src = url;
  video.crossOrigin = "anonymous";

  const frames: VideoFrame[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video"));
      setTimeout(() => reject(new Error("Timed out loading video")), 20000);
    });

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error("Invalid video duration");
    }

    for (let i = 0; i < count; i++) {
      const time = (i / Math.max(1, count - 1)) * duration;
      await seekTo(video, time);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / Math.max(1, video.videoWidth));
      canvas.width = Math.max(1, Math.floor(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.floor(video.videoHeight * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push({
          index: i,
          time,
          dataUrl: canvas.toDataURL("image/jpeg", 0.7),
        });
      }
      onProgress?.(i + 1, count);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  return frames;
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener("seeked", handler);
      resolve();
    };
    video.addEventListener("seeked", handler);
    video.currentTime = time;
  });
}
