"use client";

import { useEffect, useState } from "react";
import { useHexStore } from "@/lib/hex-store";
import {
  probeVideo,
  captureFrames,
  type VideoMetadata,
  type VideoFrame,
} from "@/lib/video-analysis";
import { formatSize } from "@/lib/hex-utils";
import { Loader2, Film, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VideoPanel() {
  const { bytes, fileName, fileSize, fileType, setSelection, setCursor, setHighlightRange } =
    useHexStore();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [frameCount, setFrameCount] = useState(8);
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);

  const isVideo =
    !!bytes &&
    (fileType.startsWith("video/") || /\.(mp4|m4v|webm|mov|avi|mkv|ogv)$/i.test(fileName));

  useEffect(() => {
    if (!bytes || !isVideo) {
      setMetadata(null);
      setFrames([]);
      setVideoUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMetadata(null);
    setFrames([]);

    const blob = new Blob([bytes.slice().buffer], { type: fileType || "video/*" });
    const url = URL.createObjectURL(blob);
    setVideoUrl(url);

    const file = new File([blob], fileName, { type: fileType || "video/*" });
    probeVideo(file)
      .then((m) => {
        if (cancelled) return;
        setMetadata(m);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [bytes, fileName, fileType]);

  const handleCapture = async () => {
    if (!bytes || !isVideo) return;
    const blob = new Blob([bytes.slice().buffer], { type: fileType || "video/*" });
    const file = new File([blob], fileName, { type: fileType || "video/*" });
    setCapturing(true);
    setCaptureProgress(0);
    setFrames([]);
    try {
      const f = await captureFrames(file, frameCount, 160, (d, t) => setCaptureProgress(d / t));
      setFrames(f);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCapturing(false);
    }
  };

  const jumpToByte = (offset: number, size: number) => {
    setCursor(offset);
    setSelection(offset, offset + size);
    setHighlightRange({ start: offset, end: offset + size, color: "#3b82f6" });
  };

  if (!bytes) {
    return <div className="text-muted-foreground text-sm p-4">No file loaded.</div>;
  }

  if (!isVideo) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Video analysis is available for video files. Current file ({fileName || "untitled"}) is not
        recognized as video.
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Film className="h-4 w-4" />
        Video Analysis
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Probing video metadata...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
          <div className="font-semibold text-destructive mb-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Could not decode video
          </div>
          {error}
          <div className="mt-2 text-muted-foreground">
            The browser may lack the codec (e.g. MKV/AVI on most browsers). You can still inspect
            the raw bytes via the hex view and structure tabs.
          </div>
        </div>
      )}

      {videoUrl && metadata && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Duration" value={`${metadata.duration.toFixed(2)} s`} />
            <Stat label="Width" value={`${metadata.width} px`} />
            <Stat label="Height" value={`${metadata.height} px`} />
            <Stat label="Aspect Ratio" value={(metadata.width / Math.max(1, metadata.height)).toFixed(3)} />
            <Stat label="File Size" value={formatSize(fileSize)} />
            <Stat
              label="Bitrate"
              value={
                metadata.duration > 0
                  ? `${((fileSize * 8) / metadata.duration / 1000).toFixed(1)} kbps`
                  : "—"
              }
            />
          </div>

          <div>
            <div className="text-xs font-semibold mb-1">Preview</div>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-md border bg-black"
              style={{ maxHeight: 240 }}
            />
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs">Number of frames to capture</Label>
                <Input
                  type="number"
                  min={2}
                  max={32}
                  value={frameCount}
                  onChange={(e) =>
                    setFrameCount(Math.max(2, Math.min(32, parseInt(e.target.value) || 8)))
                  }
                  className="h-8"
                />
              </div>
              <Button onClick={handleCapture} disabled={capturing} size="sm">
                {capturing ? `Capturing (${(captureProgress * 100).toFixed(0)}%)` : "Capture Frames"}
              </Button>
            </div>

            {capturing && (
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${captureProgress * 100}%` }}
                />
              </div>
            )}

            {frames.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-2">Extracted Frames</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {frames.map((f) => (
                    <button
                      key={f.index}
                      onClick={() => jumpToByte(0, 16)}
                      className="group rounded-md overflow-hidden border bg-black relative"
                      title={`Frame ${f.index} @ ${f.time.toFixed(2)}s`}
                    >
                      <img
                        src={f.dataUrl}
                        alt={`Frame ${f.index}`}
                        className="w-full h-auto block"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-mono px-1 py-0.5">
                        #{f.index} @ {f.time.toFixed(2)}s
                      </div>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Tip: frame extraction requires the browser to support the video codec. Click a
                  frame to jump to the start of the file in the hex view.
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
