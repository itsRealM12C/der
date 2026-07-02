/**
 * Audio analysis utilities using the Web Audio API.
 * Computes waveform peaks, spectrogram frames, and basic metadata.
 */

export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  length: number; // sample frames
  bitrate: number | null; // estimated from file size / duration
  format: string;
}

export interface WaveformPeaks {
  /** Two arrays (min, max) per bucket — length is `buckets`. */
  min: Float32Array;
  max: Float32Array;
  buckets: number;
}

/**
 * Decode an audio file and return metadata + raw PCM channel data.
 * Uses AudioContext.decodeAudioData.
 */
export async function decodeAudio(
  arrayBuffer: ArrayBuffer,
  format = "audio"
): Promise<{
  audioBuffer: AudioBuffer;
  metadata: AudioMetadata;
  channelData: Float32Array[];
}> {
  const Ctor =
    (typeof window !== "undefined" &&
      ((window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) ||
    null;
  if (!Ctor) {
    throw new Error("Web Audio API not available in this environment");
  }
  const ctx = new Ctor();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelData: Float32Array[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channelData.push(audioBuffer.getChannelData(c));
    }
    const metadata: AudioMetadata = {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
      bitrate: audioBuffer.duration > 0 ? (arrayBuffer.byteLength * 8) / audioBuffer.duration : null,
      format,
    };
    return { audioBuffer, metadata, channelData };
  } finally {
    ctx.close();
  }
}

/**
 * Compute waveform peaks (min/max per bucket) from raw PCM data.
 * Mixes all channels down to mono for display.
 */
export function computeWaveform(
  channelData: Float32Array[],
  buckets: number
): WaveformPeaks {
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const total = channelData[0]?.length ?? 0;
  if (total === 0) return { min, max, buckets };
  const samplesPerBucket = Math.max(1, Math.floor(total / buckets));
  for (let b = 0; b < buckets; b++) {
    let mn = 1.0;
    let mx = -1.0;
    const start = b * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, total);
    for (let i = start; i < end; i++) {
      let v = 0;
      for (let c = 0; c < channelData.length; c++) {
        v += channelData[c][i];
      }
      v /= channelData.length;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    min[b] = mn;
    max[b] = mx;
  }
  return { min, max, buckets };
}

/**
 * Compute a spectrogram using an offline FFT.
 * Uses a simple Hann window + radix-2 FFT.
 */
export function computeSpectrogram(
  channelData: Float32Array[],
  fftSize = 1024,
  hopSize = 512,
  maxFrames = 200
): { magnitudes: Float32Array; frames: number; bins: number } {
  const signal = channelData[0];
  if (!signal || signal.length === 0) {
    return { magnitudes: new Float32Array(0), frames: 0, bins: fftSize / 2 };
  }
  const bins = fftSize / 2;
  const frames = Math.min(maxFrames, Math.max(1, Math.floor((signal.length - fftSize) / hopSize) + 1));
  const magnitudes = new Float32Array(frames * bins);
  const window = hannWindow(fftSize);
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);
  for (let f = 0; f < frames; f++) {
    const start = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      real[i] = signal[start + i] * window[i];
      imag[i] = 0;
    }
    fftInPlace(real, imag);
    for (let b = 0; b < bins; b++) {
      const re = real[b];
      const im = imag[b];
      magnitudes[f * bins + b] = Math.sqrt(re * re + im * im);
    }
  }
  // Normalize magnitudes to dB scale (clamped)
  let maxMag = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMag) maxMag = magnitudes[i];
  }
  if (maxMag > 0) {
    for (let i = 0; i < magnitudes.length; i++) {
      const norm = magnitudes[i] / maxMag;
      magnitudes[i] = norm <= 0 ? 0 : Math.log10(norm * 1000 + 1) / 3;
    }
  }
  return { magnitudes, frames, bins };
}

function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return w;
}

/** In-place iterative radix-2 FFT. Sizes must be powers of 2. */
function fftInPlace(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  // Bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const angle = (-2 * Math.PI) / size;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < n; i += size) {
      let curReal = 1;
      let curImag = 0;
      for (let j = i; j < i + half; j++) {
        const tReal = curReal * real[j + half] - curImag * imag[j + half];
        const tImag = curReal * imag[j + half] + curImag * real[j + half];
        real[j + half] = real[j] - tReal;
        imag[j + half] = imag[j] - tImag;
        real[j] += tReal;
        imag[j] += tImag;
        const nextReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = nextReal;
      }
    }
  }
}

/** Draw a waveform to a canvas context. */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: WaveformPeaks,
  width: number,
  height: number,
  color = "#10b981",
  bgColor = "transparent"
): void {
  if (bgColor !== "transparent") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  const mid = height / 2;
  const barW = Math.max(1, width / peaks.buckets);
  for (let i = 0; i < peaks.buckets; i++) {
    const x = (i / peaks.buckets) * width;
    const y1 = mid - peaks.max[i] * mid;
    const y2 = mid - peaks.min[i] * mid;
    ctx.fillRect(x, y1, Math.max(1, barW - 0.5), Math.max(1, y2 - y1));
  }
}

/** Draw a spectrogram to a canvas context (heat map). */
export function drawSpectrogram(
  ctx: CanvasRenderingContext2D,
  spec: { magnitudes: Float32Array; frames: number; bins: number },
  width: number,
  height: number
): void {
  const { magnitudes, frames, bins } = spec;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;
  for (let y = 0; y < height; y++) {
    // top = high freq, bottom = low freq
    const bin = Math.floor(((height - y) / height) * bins);
    for (let x = 0; x < width; x++) {
      const frame = Math.floor((x / width) * frames);
      const mag = magnitudes[frame * bins + bin] || 0;
      const [r, g, b] = heatColor(mag);
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function heatColor(v: number): [number, number, number] {
  // 0 -> black, 0.25 -> blue, 0.5 -> green, 0.75 -> yellow, 1 -> red
  const t = Math.max(0, Math.min(1, v));
  if (t < 0.25) {
    const k = t / 0.25;
    return [0, Math.floor(k * 80), Math.floor(k * 200)];
  } else if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    return [0, Math.floor(80 + k * 175), Math.floor(200 - k * 200)];
  } else if (t < 0.75) {
    const k = (t - 0.5) / 0.25;
    return [Math.floor(k * 255), Math.floor(255), Math.floor(0)];
  } else {
    const k = (t - 0.75) / 0.25;
    return [255, Math.floor(255 - k * 200), 0];
  }
}
