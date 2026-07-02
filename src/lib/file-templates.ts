/**
 * File signature (magic bytes) detection and structure templates.
 * Used by the "File Structure" panel to annotate the hex view with parsed fields.
 */

export type FieldValue =
  | { kind: "uint8"; value: number }
  | { kind: "uint16"; value: number }
  | { kind: "uint32"; value: number }
  | { kind: "uint64"; value: bigint }
  | { kind: "int8"; value: number }
  | { kind: "int16"; value: number }
  | { kind: "int32"; value: number }
  | { kind: "int64"; value: bigint }
  | { kind: "float32"; value: number }
  | { kind: "float64"; value: number }
  | { kind: "ascii"; value: string }
  | { kind: "hex"; value: string }
  | { kind: "bytes"; value: string };

export interface ParsedField {
  offset: number;
  size: number;
  name: string;
  value: FieldValue;
  description?: string;
  color?: string;
}

export interface FileTemplate {
  id: string;
  name: string;
  mime: string[];
  magic: { offset: number; bytes: number[]; mask?: number[] }[];
  parse: (bytes: Uint8Array) => ParsedField[];
}

function hex(b: Uint8Array, off: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += (b[off + i] ?? 0).toString(16).padStart(2, "0").toUpperCase();
  return s;
}

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c <= 126 ? String.fromCharCode(c) : ".";
  }
  return s;
}

function u16(b: Uint8Array, off: number, le = true): number {
  return le ? (b[off] | (b[off + 1] << 8)) & 0xffff : ((b[off] << 8) | b[off + 1]) & 0xffff;
}

function u32(b: Uint8Array, off: number, le = true): number {
  return le
    ? ((b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)) >>> 0)
    : (((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0);
}

export const FILE_TEMPLATES: FileTemplate[] = [
  {
    id: "png",
    name: "PNG Image",
    mime: ["image/png"],
    magic: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
    parse: (b) => {
      const fields: ParsedField[] = [
        {
          offset: 0,
          size: 8,
          name: "Signature",
          value: { kind: "hex", value: hex(b, 0, 8) },
          description: "PNG file signature (\\x89PNG\\r\\n\\x1a\\n)",
          color: "#7c3aed",
        },
      ];
      let pos = 8;
      const COLORS = ["#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777"];
      let i = 0;
      while (pos + 8 <= b.length && i < 50) {
        const length = u32(b, pos, false); // PNG is big-endian
        const type = ascii(b, pos + 4, 4);
        const isAncillary = (b[pos + 4] & 0x20) !== 0;
        fields.push({
          offset: pos,
          size: 4,
          name: `${type} Length`,
          value: { kind: "uint32", value: length },
          description: `${type} chunk data length (${length} bytes)`,
          color: COLORS[i % COLORS.length],
        });
        fields.push({
          offset: pos + 4,
          size: 4,
          name: `${type} Type`,
          value: { kind: "ascii", value: type },
          description: isAncillary ? "Ancillary chunk" : "Critical chunk",
          color: COLORS[i % COLORS.length],
        });
        fields.push({
          offset: pos + 8,
          size: Math.min(length, 32),
          name: `${type} Data`,
          value: { kind: "hex", value: hex(b, pos + 8, Math.min(length, 32)) },
          description:
            length > 32 ? `First 32 of ${length} bytes (truncated)` : `${length} bytes`,
          color: COLORS[i % COLORS.length],
        });
        if (pos + 8 + length + 4 <= b.length) {
          fields.push({
            offset: pos + 8 + length,
            size: 4,
            name: `${type} CRC`,
            value: { kind: "hex", value: hex(b, pos + 8 + length, 4) },
            description: "CRC-32 of type+data",
            color: COLORS[i % COLORS.length],
          });
        }
        pos += 8 + length + 4;
        i++;
        if (type === "IEND") break;
      }
      return fields;
    },
  },
  {
    id: "jpg",
    name: "JPEG Image",
    mime: ["image/jpeg"],
    magic: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
    parse: (b) => {
      const fields: ParsedField[] = [
        {
          offset: 0,
          size: 2,
          name: "SOI",
          value: { kind: "hex", value: "FFD8" },
          description: "Start of Image marker",
          color: "#7c3aed",
        },
      ];
      let pos = 2;
      const COLORS = ["#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#2563eb"];
      let i = 0;
      while (pos + 4 <= b.length && i < 30) {
        if (b[pos] !== 0xff) break;
        const marker = u16(b, pos, false);
        const name = JPEG_MARKERS[marker] || `Unknown (0x${marker.toString(16).toUpperCase()})`;
        const hasLength = !(marker === 0xffd9 || marker === 0xff01 || (marker >= 0xffd0 && marker <= 0xffd7));
        if (!hasLength) {
          fields.push({
            offset: pos,
            size: 2,
            name: name,
            value: { kind: "hex", value: hex(b, pos, 2) },
            description: "Standalone marker",
            color: COLORS[i % COLORS.length],
          });
          pos += 2;
        } else {
          const segLen = u16(b, pos + 2, false);
          fields.push({
            offset: pos,
            size: 2,
            name: name,
            value: { kind: "hex", value: hex(b, pos, 2) },
            description: "Marker",
            color: COLORS[i % COLORS.length],
          });
          fields.push({
            offset: pos + 2,
            size: 2,
            name: `${name} Length`,
            value: { kind: "uint16", value: segLen },
            description: `Segment length (${segLen} bytes including this field)`,
            color: COLORS[i % COLORS.length],
          });
          if (segLen >= 2) {
            fields.push({
              offset: pos + 4,
              size: Math.min(segLen - 2, 32),
              name: `${name} Data`,
              value: { kind: "hex", value: hex(b, pos + 4, Math.min(segLen - 2, 32)) },
              description: segLen - 2 > 32 ? `First 32 of ${segLen - 2} bytes (truncated)` : `${segLen - 2} bytes`,
              color: COLORS[i % COLORS.length],
            });
          }
          pos += 2 + segLen;
          if (marker === 0xffda) break; // SOS followed by entropy-coded data
        }
        i++;
      }
      return fields;
    },
  },
  {
    id: "gif",
    name: "GIF Image",
    mime: ["image/gif"],
    magic: [
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
    ],
    parse: (b) => {
      const fields: ParsedField[] = [
        {
          offset: 0,
          size: 6,
          name: "Signature + Version",
          value: { kind: "ascii", value: ascii(b, 0, 6) },
          description: "GIF version (87a or 89a)",
          color: "#7c3aed",
        },
        {
          offset: 6,
          size: 2,
          name: "Logical Screen Width",
          value: { kind: "uint16", value: u16(b, 6) },
          color: "#0891b2",
        },
        {
          offset: 8,
          size: 2,
          name: "Logical Screen Height",
          value: { kind: "uint16", value: u16(b, 8) },
          color: "#0891b2",
        },
        {
          offset: 10,
          size: 1,
          name: "Packed Field",
          value: { kind: "uint8", value: b[10] },
          description: "Global color table flag, color resolution, sort, size",
          color: "#0891b2",
        },
        {
          offset: 11,
          size: 1,
          name: "Background Color Index",
          value: { kind: "uint8", value: b[11] },
          color: "#0891b2",
        },
        {
          offset: 12,
          size: 1,
          name: "Pixel Aspect Ratio",
          value: { kind: "uint8", value: b[12] },
          color: "#0891b2",
        },
      ];
      return fields;
    },
  },
  {
    id: "bmp",
    name: "BMP Image",
    mime: ["image/bmp"],
    magic: [{ offset: 0, bytes: [0x42, 0x4d] }],
    parse: (b) => [
      {
        offset: 0,
        size: 2,
        name: "Signature",
        value: { kind: "ascii", value: ascii(b, 0, 2) },
        description: "BM",
        color: "#7c3aed",
      },
      {
        offset: 2,
        size: 4,
        name: "File Size",
        value: { kind: "uint32", value: u32(b, 2) },
        color: "#0891b2",
      },
      {
        offset: 6,
        size: 4,
        name: "Reserved",
        value: { kind: "hex", value: hex(b, 6, 4) },
        color: "#0891b2",
      },
      {
        offset: 10,
        size: 4,
        name: "Pixel Data Offset",
        value: { kind: "uint32", value: u32(b, 10) },
        description: "Offset to pixel data",
        color: "#0891b2",
      },
      {
        offset: 14,
        size: 4,
        name: "DIB Header Size",
        value: { kind: "uint32", value: u32(b, 14) },
        description: "Size of the DIB header (40 for BITMAPINFOHEADER)",
        color: "#059669",
      },
      {
        offset: 18,
        size: 4,
        name: "Width",
        value: { kind: "int32", value: u32(b, 18) | 0 },
        color: "#059669",
      },
      {
        offset: 22,
        size: 4,
        name: "Height",
        value: { kind: "int32", value: u32(b, 22) | 0 },
        color: "#059669",
      },
      {
        offset: 26,
        size: 2,
        name: "Color Planes",
        value: { kind: "uint16", value: u16(b, 26) },
        color: "#059669",
      },
      {
        offset: 28,
        size: 2,
        name: "Bits Per Pixel",
        value: { kind: "uint16", value: u16(b, 28) },
        color: "#059669",
      },
    ],
  },
  {
    id: "wav",
    name: "WAV Audio",
    mime: ["audio/wav", "audio/x-wav"],
    magic: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    ],
    parse: (b) => {
      const isWave = ascii(b, 8, 4) === "WAVE";
      const fields: ParsedField[] = [
        {
          offset: 0,
          size: 4,
          name: "Chunk ID",
          value: { kind: "ascii", value: ascii(b, 0, 4) },
          description: "RIFF",
          color: "#7c3aed",
        },
        {
          offset: 4,
          size: 4,
          name: "Chunk Size",
          value: { kind: "uint32", value: u32(b, 4) },
          description: "File size - 8",
          color: "#7c3aed",
        },
        {
          offset: 8,
          size: 4,
          name: "Format",
          value: { kind: "ascii", value: ascii(b, 8, 4) },
          description: isWave ? "WAVE" : "Unknown format",
          color: "#7c3aed",
        },
      ];
      if (isWave) {
        let pos = 12;
        const COLORS = ["#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"];
        let i = 0;
        while (pos + 8 <= b.length && i < 20) {
          const id = ascii(b, pos, 4);
          const sz = u32(b, pos + 4);
          fields.push({
            offset: pos,
            size: 4,
            name: `${id} ID`,
            value: { kind: "ascii", value: id },
            color: COLORS[i % COLORS.length],
          });
          fields.push({
            offset: pos + 4,
            size: 4,
            name: `${id} Size`,
            value: { kind: "uint32", value: sz },
            color: COLORS[i % COLORS.length],
          });
          if (id === "fmt ") {
            fields.push({
              offset: pos + 8,
              size: 2,
              name: "Audio Format",
              value: { kind: "uint16", value: u16(b, pos + 8) },
              description: u16(b, pos + 8) === 1 ? "PCM" : `0x${u16(b, pos + 8).toString(16)}`,
              color: COLORS[i % COLORS.length],
            });
            fields.push({
              offset: pos + 10,
              size: 2,
              name: "Num Channels",
              value: { kind: "uint16", value: u16(b, pos + 10) },
              color: COLORS[i % COLORS.length],
            });
            fields.push({
              offset: pos + 12,
              size: 4,
              name: "Sample Rate",
              value: { kind: "uint32", value: u32(b, pos + 12) },
              color: COLORS[i % COLORS.length],
            });
            fields.push({
              offset: pos + 16,
              size: 4,
              name: "Byte Rate",
              value: { kind: "uint32", value: u32(b, pos + 16) },
              description: "SampleRate * NumChannels * BitsPerSample/8",
              color: COLORS[i % COLORS.length],
            });
            fields.push({
              offset: pos + 20,
              size: 2,
              name: "Block Align",
              value: { kind: "uint16", value: u16(b, pos + 20) },
              color: COLORS[i % COLORS.length],
            });
            fields.push({
              offset: pos + 22,
              size: 2,
              name: "Bits Per Sample",
              value: { kind: "uint16", value: u16(b, pos + 22) },
              color: COLORS[i % COLORS.length],
            });
          }
          pos += 8 + sz + (sz % 2 === 1 ? 1 : 0);
          i++;
        }
      }
      return fields;
    },
  },
  {
    id: "mp3",
    name: "MP3 Audio",
    mime: ["audio/mpeg"],
    magic: [
      { offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3
      { offset: 0, bytes: [0xff, 0xfb] },
      { offset: 0, bytes: [0xff, 0xf3] },
      { offset: 0, bytes: [0xff, 0xf2] },
    ],
    parse: (b) => {
      const fields: ParsedField[] = [];
      if (ascii(b, 0, 3) === "ID3") {
        fields.push({
          offset: 0,
          size: 3,
          name: "ID3v2 Signature",
          value: { kind: "ascii", value: "ID3" },
          color: "#7c3aed",
        });
        fields.push({
          offset: 3,
          size: 2,
          name: "Version",
          value: { kind: "hex", value: hex(b, 3, 2) },
          description: `ID3v2.${b[3]}.${b[4]}`,
          color: "#7c3aed",
        });
        fields.push({
          offset: 5,
          size: 1,
          name: "Flags",
          value: { kind: "uint8", value: b[5] },
          color: "#7c3aed",
        });
        // Synchsafe integer
        const size =
          ((b[6] & 0x7f) << 21) |
          ((b[7] & 0x7f) << 14) |
          ((b[8] & 0x7f) << 7) |
          (b[9] & 0x7f);
        fields.push({
          offset: 6,
          size: 4,
          name: "Size (synchsafe)",
          value: { kind: "uint32", value: size },
          description: "Size of ID3v2 body (synchsafe)",
          color: "#7c3aed",
        });
        fields.push({
          offset: 10,
          size: 10,
          name: "First Frame Header",
          value: { kind: "hex", value: hex(b, 10, 10) },
          color: "#0891b2",
        });
      } else if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) {
        const versionBits = (b[1] >> 3) & 0x03;
        const layerBits = (b[1] >> 1) & 0x03;
        const version = ["MPEG 2.5", "reserved", "MPEG 2", "MPEG 1"][versionBits];
        const layer = ["reserved", "Layer III", "Layer II", "Layer I"][layerBits];
        fields.push({
          offset: 0,
          size: 4,
          name: "Frame Header",
          value: { kind: "hex", value: hex(b, 0, 4) },
          description: `${version} ${layer}`,
          color: "#7c3aed",
        });
      }
      return fields;
    },
  },
  {
    id: "flac",
    name: "FLAC Audio",
    mime: ["audio/flac", "audio/x-flac"],
    magic: [{ offset: 0, bytes: [0x66, 0x4c, 0x61, 0x43] }],
    parse: (b) => {
      const fields: ParsedField[] = [
        {
          offset: 0,
          size: 4,
          name: "Signature",
          value: { kind: "ascii", value: ascii(b, 0, 4) },
          description: "fLaC",
          color: "#7c3aed",
        },
      ];
      let pos = 4;
      let i = 0;
      const COLORS = ["#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"];
      while (pos + 4 <= b.length && i < 10) {
        const isLast = (b[pos] & 0x80) !== 0;
        const type = b[pos] & 0x7f;
        const len = (b[pos + 1] << 16) | (b[pos + 2] << 8) | b[pos + 3];
        const typeName =
          ["STREAMINFO", "PADDING", "APPLICATION", "SEEKTABLE", "VORBIS_COMMENT", "CUESHEET", "PICTURE"][type] ||
          `UNKNOWN(${type})`;
        fields.push({
          offset: pos,
          size: 4,
          name: `${typeName} Header`,
          value: { kind: "hex", value: hex(b, pos, 4) },
          description: `${isLast ? "Last block. " : ""}Length: ${len}`,
          color: COLORS[i % COLORS.length],
        });
        if (type === 0 && len >= 18) {
          // STREAMINFO
          fields.push({
            offset: pos + 4,
            size: 2,
            name: "Min Block Size",
            value: { kind: "uint16", value: u16(b, pos + 4, false) },
            color: COLORS[i % COLORS.length],
          });
          fields.push({
            offset: pos + 6,
            size: 2,
            name: "Max Block Size",
            value: { kind: "uint16", value: u16(b, pos + 6, false) },
            color: COLORS[i % COLORS.length],
          });
          fields.push({
            offset: pos + 18,
            size: 4,
            name: "Sample Rate Info",
            value: { kind: "hex", value: hex(b, pos + 18, 4) },
            description: "Sample rate, channels, bits per sample packed",
            color: COLORS[i % COLORS.length],
          });
        }
        pos += 4 + len;
        i++;
        if (isLast) break;
      }
      return fields;
    },
  },
  {
    id: "ogg",
    name: "OGG Container",
    mime: ["audio/ogg", "application/ogg"],
    magic: [{ offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] }],
    parse: (b) => {
      const fields: ParsedField[] = [
        {
          offset: 0,
          size: 4,
          name: "Capture Pattern",
          value: { kind: "ascii", value: ascii(b, 0, 4) },
          description: "OggS",
          color: "#7c3aed",
        },
        {
          offset: 4,
          size: 1,
          name: "Version",
          value: { kind: "uint8", value: b[4] },
          color: "#7c3aed",
        },
        {
          offset: 5,
          size: 1,
          name: "Header Type",
          value: { kind: "uint8", value: b[5] },
          description: "Continuation(0x01), BOS(0x02), EOS(0x04)",
          color: "#7c3aed",
        },
        {
          offset: 6,
          size: 8,
          name: "Granule Position",
          value: { kind: "hex", value: hex(b, 6, 8) },
          color: "#7c3aed",
        },
        {
          offset: 14,
          size: 4,
          name: "Serial Number",
          value: { kind: "uint32", value: u32(b, 14) },
          color: "#0891b2",
        },
        {
          offset: 18,
          size: 4,
          name: "Page Sequence",
          value: { kind: "uint32", value: u32(b, 18) },
          color: "#0891b2",
        },
        {
          offset: 22,
          size: 4,
          name: "Checksum",
          value: { kind: "hex", value: hex(b, 22, 4) },
          description: "CRC-32 of page",
          color: "#0891b2",
        },
        {
          offset: 26,
          size: 1,
          name: "Page Segments",
          value: { kind: "uint8", value: b[26] },
          color: "#0891b2",
        },
      ];
      return fields;
    },
  },
  {
    id: "mp4",
    name: "MP4 / ISOBMFF",
    mime: ["video/mp4", "audio/mp4", "application/mp4"],
    magic: [
      { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // 'ftyp' at offset 4
    ],
    parse: (b) => {
      const fields: ParsedField[] = [];
      const COLORS = ["#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#2563eb"];
      let pos = 0;
      let i = 0;
      while (pos + 8 <= b.length && i < 50) {
        const size = u32(b, pos, false);
        const type = ascii(b, pos + 4, 4);
        if (size < 8) break;
        fields.push({
          offset: pos,
          size: 4,
          name: `${type} Size`,
          value: { kind: "uint32", value: size },
          color: COLORS[i % COLORS.length],
        });
        fields.push({
          offset: pos + 4,
          size: 4,
          name: `${type} Type`,
          value: { kind: "ascii", value: type },
          description: "ISO BMFF box type",
          color: COLORS[i % COLORS.length],
        });
        if (type === "ftyp" && size >= 16) {
          fields.push({
            offset: pos + 8,
            size: 4,
            name: "Major Brand",
            value: { kind: "ascii", value: ascii(b, pos + 8, 4) },
            color: COLORS[i % COLORS.length],
          });
          fields.push({
            offset: pos + 12,
            size: 4,
            name: "Minor Version",
            value: { kind: "uint32", value: u32(b, pos + 12, false) },
            color: COLORS[i % COLORS.length],
          });
        }
        pos += size;
        i++;
      }
      return fields;
    },
  },
  {
    id: "webp",
    name: "WebP Image",
    mime: ["image/webp"],
    magic: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
    parse: (b) => [
      {
        offset: 0,
        size: 4,
        name: "RIFF",
        value: { kind: "ascii", value: ascii(b, 0, 4) },
        color: "#7c3aed",
      },
      {
        offset: 4,
        size: 4,
        name: "File Size",
        value: { kind: "uint32", value: u32(b, 4) },
        color: "#7c3aed",
      },
      {
        offset: 8,
        size: 4,
        name: "WEBP",
        value: { kind: "ascii", value: ascii(b, 8, 4) },
        color: "#7c3aed",
      },
      {
        offset: 12,
        size: 4,
        name: "Chunk FourCC",
        value: { kind: "ascii", value: ascii(b, 12, 4) },
        description: "VP8 / VP8L / VP8X",
        color: "#0891b2",
      },
      {
        offset: 16,
        size: 4,
        name: "Chunk Size",
        value: { kind: "uint32", value: u32(b, 16) },
        color: "#0891b2",
      },
    ],
  },
  {
    id: "pdf",
    name: "PDF Document",
    mime: ["application/pdf"],
    magic: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
    parse: (b) => [
      {
        offset: 0,
        size: 8,
        name: "Header",
        value: { kind: "ascii", value: ascii(b, 0, 8) },
        description: "%PDF-x.y",
        color: "#7c3aed",
      },
    ],
  },
  {
    id: "zip",
    name: "ZIP / OOXML",
    mime: ["application/zip", "application/vnd.openxmlformats-officedocument.*"],
    magic: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
    parse: (b) => {
      const fields: ParsedField[] = [
        {
          offset: 0,
          size: 4,
          name: "Local File Header Sig",
          value: { kind: "hex", value: hex(b, 0, 4) },
          description: "PK\\x03\\x04",
          color: "#7c3aed",
        },
        {
          offset: 4,
          size: 2,
          name: "Version Needed",
          value: { kind: "uint16", value: u16(b, 4) },
          color: "#0891b2",
        },
        {
          offset: 6,
          size: 2,
          name: "Flags",
          value: { kind: "uint16", value: u16(b, 6) },
          color: "#0891b2",
        },
        {
          offset: 8,
          size: 2,
          name: "Compression Method",
          value: { kind: "uint16", value: u16(b, 8) },
          description: "0=stored, 8=deflate",
          color: "#0891b2",
        },
        {
          offset: 10,
          size: 2,
          name: "Last Mod Time",
          value: { kind: "uint16", value: u16(b, 10) },
          color: "#0891b2",
        },
        {
          offset: 12,
          size: 2,
          name: "Last Mod Date",
          value: { kind: "uint16", value: u16(b, 12) },
          color: "#0891b2",
        },
        {
          offset: 14,
          size: 4,
          name: "CRC-32",
          value: { kind: "hex", value: hex(b, 14, 4) },
          color: "#059669",
        },
        {
          offset: 18,
          size: 4,
          name: "Compressed Size",
          value: { kind: "uint32", value: u32(b, 18) },
          color: "#059669",
        },
        {
          offset: 22,
          size: 4,
          name: "Uncompressed Size",
          value: { kind: "uint32", value: u32(b, 22) },
          color: "#059669",
        },
        {
          offset: 26,
          size: 2,
          name: "Filename Length",
          value: { kind: "uint16", value: u16(b, 26) },
          color: "#d97706",
        },
        {
          offset: 28,
          size: 2,
          name: "Extra Field Length",
          value: { kind: "uint16", value: u16(b, 28) },
          color: "#d97706",
        },
      ];
      const nameLen = u16(b, 26);
      if (nameLen > 0) {
        fields.push({
          offset: 30,
          size: Math.min(nameLen, 64),
          name: "Filename",
          value: { kind: "ascii", value: ascii(b, 30, Math.min(nameLen, 64)) },
          color: "#d97706",
        });
      }
      return fields;
    },
  },
  {
    id: "gzip",
    name: "GZIP Archive",
    mime: ["application/gzip"],
    magic: [{ offset: 0, bytes: [0x1f, 0x8b] }],
    parse: (b) => [
      {
        offset: 0,
        size: 2,
        name: "Magic",
        value: { kind: "hex", value: hex(b, 0, 2) },
        description: "0x1f 0x8b",
        color: "#7c3aed",
      },
      {
        offset: 2,
        size: 1,
        name: "Compression Method",
        value: { kind: "uint8", value: b[2] },
        description: "8 = deflate",
        color: "#7c3aed",
      },
      {
        offset: 3,
        size: 1,
        name: "Flags",
        value: { kind: "uint8", value: b[3] },
        description: "FTEXT, FHCRC, FEXTRA, FNAME, FCOMMENT",
        color: "#7c3aed",
      },
      {
        offset: 4,
        size: 4,
        name: "Modification Time",
        value: { kind: "uint32", value: u32(b, 4) },
        description: "Unix timestamp",
        color: "#0891b2",
      },
      {
        offset: 8,
        size: 1,
        name: "Extra Flags",
        value: { kind: "uint8", value: b[8] },
        color: "#0891b2",
      },
      {
        offset: 9,
        size: 1,
        name: "OS",
        value: { kind: "uint8", value: b[9] },
        description: "0=FAT, 3=Unix, 11=NTFS, 255=unknown",
        color: "#0891b2",
      },
    ],
  },
  {
    id: "elf",
    name: "ELF Binary",
    mime: ["application/x-elf", "application/x-executable"],
    magic: [
      { offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46] },
    ],
    parse: (b) => {
      const fields: ParsedField[] = [
        {
          offset: 0,
          size: 4,
          name: "Magic",
          value: { kind: "ascii", value: ascii(b, 0, 4) },
          description: "\\x7fELF",
          color: "#7c3aed",
        },
        {
          offset: 4,
          size: 1,
          name: "Class",
          value: { kind: "uint8", value: b[4] },
          description: b[4] === 1 ? "32-bit" : b[4] === 2 ? "64-bit" : "Invalid",
          color: "#7c3aed",
        },
        {
          offset: 5,
          size: 1,
          name: "Data Encoding",
          value: { kind: "uint8", value: b[5] },
          description: b[5] === 1 ? "Little endian" : b[5] === 2 ? "Big endian" : "Invalid",
          color: "#7c3aed",
        },
        {
          offset: 6,
          size: 1,
          name: "Version",
          value: { kind: "uint8", value: b[6] },
          color: "#7c3aed",
        },
        {
          offset: 7,
          size: 1,
          name: "OS/ABI",
          value: { kind: "uint8", value: b[7] },
          color: "#7c3aed",
        },
        {
          offset: 8,
          size: 8,
          name: "Padding",
          value: { kind: "hex", value: hex(b, 8, 8) },
          color: "#7c3aed",
        },
        {
          offset: 16,
          size: 2,
          name: "Type",
          value: { kind: "uint16", value: u16(b, 16) },
          description: ["NONE", "REL", "EXEC", "DYN", "CORE"][u16(b, 16)] || "Unknown",
          color: "#0891b2",
        },
        {
          offset: 18,
          size: 2,
          name: "Machine",
          value: { kind: "uint16", value: u16(b, 18) },
          description:
            u16(b, 18) === 0x3e
              ? "x86-64"
              : u16(b, 18) === 0x03
              ? "x86"
              : u16(b, 18) === 0xb7
              ? "AArch64"
              : u16(b, 18) === 0x28
              ? "ARM"
              : "Other",
          color: "#0891b2",
        },
      ];
      return fields;
    },
  },
  {
    id: "pe",
    name: "PE / Windows EXE",
    mime: ["application/x-msdownload", "application/vnd.microsoft.portable-executable"],
    magic: [{ offset: 0, bytes: [0x4d, 0x5a] }],
    parse: (b) => {
      const fields: ParsedField[] = [
        {
          offset: 0,
          size: 2,
          name: "MZ Signature",
          value: { kind: "ascii", value: ascii(b, 0, 2) },
          description: "Mark Zbikowski header",
          color: "#7c3aed",
        },
        {
          offset: 3,
          size: 1,
          name: "Last Page Size",
          value: { kind: "uint8", value: b[3] },
          color: "#7c3aed",
        },
        {
          offset: 60,
          size: 4,
          name: "PE Header Offset",
          value: { kind: "uint32", value: u32(b, 60) },
          description: "Offset to PE header",
          color: "#0891b2",
        },
      ];
      const peOff = u32(b, 60);
      if (peOff > 0 && peOff + 24 < b.length) {
        const peSig = u32(b, peOff);
        if (peSig === 0x00004550) {
          fields.push({
            offset: peOff,
            size: 4,
            name: "PE Signature",
            value: { kind: "hex", value: hex(b, peOff, 4) },
            description: "PE\\0\\0",
            color: "#059669",
          });
          fields.push({
            offset: peOff + 4,
            size: 2,
            name: "Machine",
            value: { kind: "uint16", value: u16(b, peOff + 4) },
            description:
              u16(b, peOff + 4) === 0x14c
                ? "x86"
                : u16(b, peOff + 4) === 0x8664
                ? "x86-64"
                : u16(b, peOff + 4) === 0xaa64
                ? "ARM64"
                : "Other",
            color: "#059669",
          });
          fields.push({
            offset: peOff + 6,
            size: 2,
            name: "Number of Sections",
            value: { kind: "uint16", value: u16(b, peOff + 6) },
            color: "#059669",
          });
        }
      }
      return fields;
    },
  },
  {
    id: "class",
    name: "Java Class",
    magic: [{ offset: 0, bytes: [0xca, 0xfe, 0xba, 0xbe] }],
    mime: ["application/x-java-applet"],
    parse: (b) => [
      {
        offset: 0,
        size: 4,
        name: "Magic",
        value: { kind: "hex", value: hex(b, 0, 4) },
        description: "0xCAFEBABE",
        color: "#7c3aed",
      },
      {
        offset: 4,
        size: 2,
        name: "Minor Version",
        value: { kind: "uint16", value: u16(b, 4, false) },
        color: "#7c3aed",
      },
      {
        offset: 6,
        size: 2,
        name: "Major Version",
        value: { kind: "uint16", value: u16(b, 6, false) },
        description: "52 = Java 8, 61 = Java 17",
        color: "#7c3aed",
      },
      {
        offset: 8,
        size: 2,
        name: "Constant Pool Count",
        value: { kind: "uint16", value: u16(b, 8, false) },
        color: "#0891b2",
      },
    ],
  },
];

const JPEG_MARKERS: Record<number, string> = {
  0xffc0: "SOF0",
  0xffc1: "SOF1",
  0xffc2: "SOF2",
  0xffc4: "DHT",
  0xffd8: "SOI",
  0xffd9: "EOI",
  0xffda: "SOS",
  0xffdb: "DQT",
  0xffdd: "DRI",
  0xffe0: "APP0",
  0xffe1: "APP1",
  0xffe2: "APP2",
  0xffed: "APP13",
  0xffee: "APP14",
  0xffef: "APP15",
  0xfffe: "COM",
};

/** Detect file template by magic bytes. Returns the first matching template. */
export function detectTemplate(bytes: Uint8Array): FileTemplate | null {
  for (const tpl of FILE_TEMPLATES) {
    for (const m of tpl.magic) {
      if (m.offset + m.bytes.length > bytes.length) continue;
      let match = true;
      for (let i = 0; i < m.bytes.length; i++) {
        const actual = bytes[m.offset + i];
        const expected = m.bytes[i];
        if (m.mask && m.mask[i] !== undefined) {
          if ((actual & m.mask[i]) !== (expected & m.mask[i])) {
            match = false;
            break;
          }
        } else if (actual !== expected) {
          match = false;
          break;
        }
      }
      if (match) {
        // For RIFF, verify WAVE/WEBP subtype
        if (tpl.id === "wav" && ascii(bytes, 8, 4) !== "WAVE") continue;
        if (tpl.id === "webp" && ascii(bytes, 8, 4) !== "WEBP") continue;
        return tpl;
      }
    }
  }
  return null;
}

/** Guess a mime type from a File's name + type. */
export function guessMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    pdf: "application/pdf",
    zip: "application/zip",
    gz: "application/gzip",
    elf: "application/x-elf",
    class: "application/x-java-applet",
  };
  return map[ext] || "application/octet-stream";
}
