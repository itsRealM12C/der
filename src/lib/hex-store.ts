"use client";

import { create } from "zustand";

export interface HexState {
  /** Raw bytes of the loaded file. */
  bytes: Uint8Array | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  /** Selected byte range (start inclusive, end exclusive). */
  selectionStart: number;
  selectionEnd: number;
  /** Cursor position (single-byte cursor). */
  cursor: number;
  /** Bytes per row in hex view. */
  bytesPerRow: number;
  /** Bytes per group within a row. */
  bytesPerGroup: number;
  /** Endianness for multi-byte interpretation. */
  endianness: "little" | "big";
  /** Character encoding for the ASCII column. */
  encoding: "ascii" | "latin1" | "utf8" | "utf16le" | "utf16be";
  /** Whether to show the ASCII column. */
  showAscii: boolean;
  /** Whether to show the offset column. */
  showOffset: boolean;
  /** Whether hex view is read-only (toggle off to enable editing). */
  readOnly: boolean;
  /** Overwrite vs insert mode for editing (we only support overwrite here). */
  highlightRange: { start: number; end: number; color: string } | null;

  setBytes: (bytes: Uint8Array, name: string, type: string) => void;
  setSelection: (start: number, end: number) => void;
  setCursor: (pos: number) => void;
  setBytesPerRow: (n: number) => void;
  setBytesPerGroup: (n: number) => void;
  setEndianness: (e: "little" | "big") => void;
  setEncoding: (e: "ascii" | "latin1" | "utf8" | "utf16le" | "utf16be") => void;
  setShowAscii: (v: boolean) => void;
  setShowOffset: (v: boolean) => void;
  setReadOnly: (v: boolean) => void;
  setHighlightRange: (r: { start: number; end: number; color: string } | null) => void;
  /** Overwrite a single byte at offset. */
  writeByte: (offset: number, value: number) => void;
}

export const useHexStore = create<HexState>((set) => ({
  bytes: null,
  fileName: "",
  fileSize: 0,
  fileType: "",
  selectionStart: 0,
  selectionEnd: 0,
  cursor: 0,
  bytesPerRow: 16,
  bytesPerGroup: 1,
  endianness: "little",
  encoding: "ascii",
  showAscii: true,
  showOffset: true,
  readOnly: true,
  highlightRange: null,

  setBytes: (bytes, name, type) =>
    set({
      bytes,
      fileName: name,
      fileSize: bytes.length,
      fileType: type,
      selectionStart: 0,
      selectionEnd: 0,
      cursor: 0,
      highlightRange: null,
    }),
  setSelection: (start, end) => set({ selectionStart: start, selectionEnd: end }),
  setCursor: (pos) => set({ cursor: pos }),
  setBytesPerRow: (n) => set({ bytesPerRow: n }),
  setBytesPerGroup: (n) => set({ bytesPerGroup: n }),
  setEndianness: (e) => set({ endianness: e }),
  setEncoding: (e) => set({ encoding: e }),
  setShowAscii: (v) => set({ showAscii: v }),
  setShowOffset: (v) => set({ showOffset: v }),
  setReadOnly: (v) => set({ readOnly: v }),
  setHighlightRange: (r) => set({ highlightRange: r }),
  writeByte: (offset, value) =>
    set((state) => {
      if (!state.bytes || state.readOnly) return state;
      if (offset < 0 || offset >= state.bytes.length) return state;
      const next = new Uint8Array(state.bytes);
      next[offset] = value & 0xff;
      return { bytes: next };
    }),
}));
