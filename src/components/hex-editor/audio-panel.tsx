"use client";

import { useEffect, useRef, useState } from "react";
import { useHexStore } from "@/lib/hex-store";
import {
  decodeAudio,
  drawWaveform,
  drawSpectrogram,
  computeWaveform,
  computeSpectrogram,
  type AudioMetadata,
  type WaveformPeaks,
} from "@/lib/audio-analysis";
import { formatSize } from "@/lib/hex-utils";
import { Loader2, Music, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function AudioPanel() {
  const { bytes, fileName, fileSize, fileType } = useHexStore();
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const [spec, setSpec] = useState<{ magnitudes: Float32Array; frames: number; bins: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const specCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!bytes) {
      setMetadata(null);
      setPeaks(null);
      setSpec(null);
      setAudioUrl(null);
      setError(null);
      return;
    }
    // Only attempt decode for audio files
    const isAudio =
      fileType.startsWith("audio/") ||
      /\.(wav|mp3|flac|ogg|oga|m4a|aac|opus)$/i.test(fileName);
    if (!isAudio) {
      setMetadata(null);
      setPeaks(null);
      setSpec(null);
      setAudioUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const blob = new Blob([bytes.slice().buffer], { type: fileType || "audio/*" });
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);

    (async () => {
      try {
        // Pass a copy because decodeAudioData consumes the buffer.
        const ab = bytes.slice().buffer;
        const { metadata, channelData } = await decodeAudio(ab, fileType || "audio");
        if (cancelled) return;
        setMetadata(metadata);
        setDuration(metadata.duration);
        const p = computeWaveform(channelData, 1200);
        setPeaks(p);
        const s = computeSpectrogram(channelData, 1024, 512, 300);
        setSpec(s);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message || "Could not decode audio (browser may not support this codec).");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [bytes, fileName, fileType]);

  // Draw waveform
  useEffect(() => {
    if (!peaks || !waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    drawWaveform(ctx, peaks, w, h, "#10b981", "rgba(16, 185, 129, 0.06)");
    // Draw playhead
    if (duration > 0) {
      const x = (currentTime / duration) * w;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }, [peaks, currentTime, duration]);

  // Draw spectrogram
  useEffect(() => {
    if (!spec || !specCanvasRef.current) return;
    const canvas = specCanvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    drawSpectrogram(ctx, spec, w, h);
  }, [spec]);

  if (!bytes) {
    return <div className="text-muted-foreground text-sm p-4">No file loaded.</div>;
  }

  const isAudio =
    fileType.startsWith("audio/") || /\.(wav|mp3|flac|ogg|oga|m4a|aac|opus)$/i.test(fileName);

  if (!isAudio) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Audio analysis is available for audio files. Current file ({fileName || "untitled"}) is not
        recognized as audio.
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Music className="h-4 w-4" />
        Audio Analysis
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Decoding audio...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
          <div className="font-semibold text-destructive mb-1">Decode failed</div>
          {error}
          <div className="mt-2 text-muted-foreground">
            You can still inspect the raw bytes via the hex view and structure tabs. The browser may
            lack the codec for this format (e.g. FLAC on Safari).
          </div>
        </div>
      )}

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {metadata && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Duration" value={`${metadata.duration.toFixed(2)} s`} />
            <Stat label="Sample Rate" value={`${metadata.sampleRate} Hz`} />
            <Stat label="Channels" value={String(metadata.numberOfChannels)} />
            <Stat label="Sample Frames" value={metadata.length.toLocaleString()} />
            <Stat
              label="Bitrate"
              value={metadata.bitrate ? `${(metadata.bitrate / 1000).toFixed(1)} kbps` : "—"}
            />
            <Stat label="File Size" value={formatSize(fileSize)} />
          </div>

          {audioUrl && (
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!audioRef.current) return;
                  if (isPlaying) audioRef.current.pause();
                  else audioRef.current.play();
                }}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Slider
                value={[currentTime]}
                max={duration || 1}
                step={0.01}
                onValueChange={(v) => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = v[0];
                    setCurrentTime(v[0]);
                  }
                }}
                className="flex-1"
              />
              <span className="text-xs font-mono text-muted-foreground">
                {currentTime.toFixed(2)} / {duration.toFixed(2)}s
              </span>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold mb-1">Waveform</div>
            <div className="rounded-md border bg-muted/20 p-1">
              <canvas ref={waveCanvasRef} className="w-full h-32" />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Mono-mixed amplitude peaks. Click play to scrub.
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold mb-1">Spectrogram</div>
            <div className="rounded-md border bg-muted/20 p-1">
              <canvas ref={specCanvasRef} className="w-full h-40" />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
              <span>Low frequency</span>
              <span>High frequency</span>
            </div>
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
