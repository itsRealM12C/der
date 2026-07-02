/**
 * Core hex editor utilities for byte interpretation, formatting, and analysis.
 * All operations work on Uint8Array for performance and correctness.
 */

export type Endianness = "little" | "big";

export type Encoding = "ascii" | "latin1" | "utf8" | "utf16le" | "utf16be";

/** Format an offset as hex with optional padding. */
export function formatOffset(offset: number, width = 8): string {
  return offset.toString(16).toUpperCase().padStart(width, "0");
}

/** Format a byte as 2-digit uppercase hex. */
export function formatByte(b: number): string {
  return b.toString(16).toUpperCase().padStart(2, "0");
}

/** Convert a Uint8Array chunk to a hex string with optional separator. */
export function bytesToHex(bytes: Uint8Array, sep = ""): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += formatByte(bytes[i]);
    if (sep) out += sep;
  }
  return sep ? out.slice(0, -sep.length) : out;
}

/** Decode bytes to printable ASCII (non-printable replaced with '.'). */
export function bytesToAscii(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += b >= 32 && b <= 126 ? String.fromCharCode(b) : ".";
  }
  return out;
}

/** Decode bytes using a TextDecoder for the given encoding, replacing errors with '.'. */
export function bytesToText(bytes: Uint8Array, encoding: Encoding): string {
  if (encoding === "ascii" || encoding === "latin1") {
    // ASCII: replace non-printable with '.'; Latin-1: pass through 0..255
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (encoding === "ascii") {
        out += b >= 32 && b <= 126 ? String.fromCharCode(b) : ".";
      } else {
        out += b >= 32 && b !== 127 ? String.fromCharCode(b) : ".";
      }
    }
    return out;
  }
  const label =
    encoding === "utf8" ? "utf-8" : encoding === "utf16le" ? "utf-16le" : "utf-16be";
  try {
    const decoder = new TextDecoder(label, { fatal: false });
    return decoder.decode(bytes);
  } catch {
    return bytesToAscii(bytes);
  }
}

/** Parse a hex string (with optional whitespace/separators) to bytes. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2 !== 0) {
    throw new Error("Hex string must have an even number of digits");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/** Read unsigned 8-bit integer at offset. */
export function readUint8(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}

/** Read signed 8-bit integer at offset. */
export function readInt8(bytes: Uint8Array, offset: number): number {
  const v = bytes[offset] ?? 0;
  return v > 0x7f ? v - 0x100 : v;
}

/** Read 16-bit unsigned integer with endianness. */
export function readUint16(bytes: Uint8Array, offset: number, endian: Endianness): number {
  if (offset + 1 >= bytes.length) return 0;
  return endian === "little"
    ? bytes[offset] | (bytes[offset + 1] << 8)
    : (bytes[offset] << 8) | bytes[offset + 1];
}

/** Read 16-bit signed integer with endianness. */
export function readInt16(bytes: Uint8Array, offset: number, endian: Endianness): number {
  const v = readUint16(bytes, offset, endian);
  return v > 0x7fff ? v - 0x10000 : v;
}

/** Read 32-bit unsigned integer with endianness. */
export function readUint32(bytes: Uint8Array, offset: number, endian: Endianness): number {
  if (offset + 3 >= bytes.length) return 0;
  if (endian === "little") {
    return (
      (bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)) >>>
      0
    );
  }
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

/** Read 32-bit signed integer with endianness. */
export function readInt32(bytes: Uint8Array, offset: number, endian: Endianness): number {
  const v = readUint32(bytes, offset, endian);
  return v > 0x7fffffff ? v - 0x100000000 : v;
}

/** Read 64-bit unsigned integer as BigInt with endianness. */
export function readUint64(bytes: Uint8Array, offset: number, endian: Endianness): bigint {
  if (offset + 7 >= bytes.length) return 0n;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  return view.getBigUint64(0, endian === "little");
}

/** Read 64-bit signed integer as BigInt with endianness. */
export function readInt64(bytes: Uint8Array, offset: number, endian: Endianness): bigint {
  if (offset + 7 >= bytes.length) return 0n;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  return view.getBigInt64(0, endian === "little");
}

/** Read 32-bit float with endianness. */
export function readFloat32(bytes: Uint8Array, offset: number, endian: Endianness): number {
  if (offset + 3 >= bytes.length) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
  return view.getFloat32(0, endian === "little");
}

/** Read 64-bit double with endianness. */
export function readFloat64(bytes: Uint8Array, offset: number, endian: Endianness): number {
  if (offset + 7 >= bytes.length) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  return view.getFloat64(0, endian === "little");
}

/** Convert a number to a binary string representation. */
export function toBinary(n: number, bits = 8): string {
  const mask = bits === 64 ? 0xffffffffffffffffn : (1 << bits) - 1;
  if (typeof n === "bigint") {
    return n.toString(2).padStart(bits, "0");
  }
  return (n & mask).toString(2).padStart(bits, "0");
}

/** Format bytes as a human-readable size string. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Shannon entropy of a byte slice (0..8 bits). */
export function entropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const counts = new Array(256).fill(0);
  for (let i = 0; i < bytes.length; i++) counts[bytes[i]]++;
  let h = 0;
  for (let i = 0; i < 256; i++) {
    if (counts[i] === 0) continue;
    const p = counts[i] / bytes.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Extract printable ASCII strings of at least `minLength` characters. */
export function extractStrings(
  bytes: Uint8Array,
  minLength = 4
): { offset: number; text: string }[] {
  const results: { offset: number; text: string }[] = [];
  let start = -1;
  let buf = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      if (start === -1) start = i;
      buf += String.fromCharCode(b);
    } else {
      if (buf.length >= minLength) {
        results.push({ offset: start, text: buf });
      }
      start = -1;
      buf = "";
    }
  }
  if (buf.length >= minLength) {
    results.push({ offset: start, text: buf });
  }
  return results;
}

/** Search for a byte pattern in the buffer. Returns offsets of all matches. */
export function findBytes(
  bytes: Uint8Array,
  pattern: Uint8Array,
  maxResults = 1000
): number[] {
  if (pattern.length === 0 || pattern.length > bytes.length) return [];
  const results: number[] = [];
  const limit = bytes.length - pattern.length;
  for (let i = 0; i <= limit && results.length < maxResults; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (bytes[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) results.push(i);
  }
  return results;
}

/** Search for a UTF-8 text pattern. */
export function findText(
  bytes: Uint8Array,
  text: string,
  maxResults = 1000
): number[] {
  const pattern = new TextEncoder().encode(text);
  return findBytes(bytes, pattern, maxResults);
}

/** Decode a single UTF-8 codepoint starting at offset. Returns [codepoint, byteLength]. */
export function decodeUtf8At(bytes: Uint8Array, offset: number): [number, number] {
  const b0 = bytes[offset];
  if (b0 === undefined) return [0, 0];
  if (b0 < 0x80) return [b0, 1];
  if ((b0 & 0xe0) === 0xc0) {
    const b1 = bytes[offset + 1] ?? 0;
    return [((b0 & 0x1f) << 6) | (b1 & 0x3f), 2];
  }
  if ((b0 & 0xf0) === 0xe0) {
    const b1 = bytes[offset + 1] ?? 0;
    const b2 = bytes[offset + 2] ?? 0;
    return [((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f), 3];
  }
  if ((b0 & 0xf8) === 0xf0) {
    const b1 = bytes[offset + 1] ?? 0;
    const b2 = bytes[offset + 2] ?? 0;
    const b3 = bytes[offset + 3] ?? 0;
    return [
      ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f),
      4,
    ];
  }
  return [b0, 1];
}
