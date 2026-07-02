/**
 * Checksum and hash computation utilities.
 * - CRC32: pure-JS implementation (table-driven)
 * - MD5/SHA-1/SHA-256/SHA-512: Web Crypto SubtleCrypto
 * - Adler-32: pure-JS implementation
 */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

/** Simple byte sum (used in some header checksums). */
export function byteSum(bytes: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < bytes.length; i++) s += bytes[i];
  return s & 0xff;
}

async function digest(algorithm: string, bytes: Uint8Array): Promise<string> {
  // Copy to a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues.
  const buf = new Uint8Array(bytes.length);
  buf.set(bytes);
  const digest = await crypto.subtle.digest(algorithm, buf.buffer);
  const view = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function md5(bytes: Uint8Array): Promise<string> {
  // SubtleCrypto does NOT support MD5 in browsers. We provide a pure-JS fallback.
  return md5Pure(bytes);
}

export function sha1(bytes: Uint8Array): Promise<string> {
  return digest("SHA-1", bytes);
}

export function sha256(bytes: Uint8Array): Promise<string> {
  return digest("SHA-256", bytes);
}

export function sha512(bytes: Uint8Array): Promise<string> {
  return digest("SHA-512", bytes);
}

/**
 * Pure-JS MD5 implementation (RFC 1321).
 * Returns the 128-bit hash as a lowercase hex string.
 */
async function md5Pure(bytes: Uint8Array): Promise<string> {
  const s = new Uint32Array([
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4,
    11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6,
    10, 15, 21,
  ]);
  const K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ]);

  const rotl = (x: number, c: number) => (x << c) | (x >>> (32 - c));

  // Pre-processing: padding
  const originalLength = bytes.length;
  const bitLength = BigInt(originalLength) * 8n;
  const paddedLength =
    ((originalLength + 8) >> 6) * 64 + 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[originalLength] = 0x80;
  // Append length in bits, little-endian, 64-bit
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Number(bitLength & 0xffffffffn), true);
  view.setUint32(paddedLength - 4, Number((bitLength >> 32n) & 0xffffffffn), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let chunk = 0; chunk < paddedLength; chunk += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] = view.getUint32(chunk + i * 4, true);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, s[i])) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  let hex = "";
  for (let i = 0; i < 16; i++) hex += out[i].toString(16).padStart(2, "0");
  return hex;
}

export type HashProgress = (computed: number, total: number) => void;

/** Run all checksums/hashes on a chunked basis so the UI stays responsive. */
export async function computeAllHashes(
  bytes: Uint8Array,
  onProgress?: HashProgress
): Promise<{
  crc32: string;
  adler32: string;
  byteSum: string;
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
}> {
  onProgress?.(0, 7);
  const crc = crc32(bytes).toString(16).padStart(8, "0");
  onProgress?.(1, 7);
  const adler = adler32(bytes).toString(16).padStart(8, "0");
  onProgress?.(2, 7);
  const sum = byteSum(bytes).toString(16).padStart(2, "0");
  onProgress?.(3, 7);
  const md5Hex = await md5(bytes);
  onProgress?.(4, 7);
  const sha1Hex = await sha1(bytes);
  onProgress?.(5, 7);
  const sha256Hex = await sha256(bytes);
  onProgress?.(6, 7);
  const sha512Hex = await sha512(bytes);
  onProgress?.(7, 7);
  return {
    crc32: crc,
    adler32: adler,
    byteSum: sum,
    md5: md5Hex,
    sha1: sha1Hex,
    sha256: sha256Hex,
    sha512: sha512Hex,
  };
}
