"use client";

import { useMemo } from "react";
import { useHexStore } from "@/lib/hex-store";
import {
  bytesToHex,
  formatOffset,
  readFloat32,
  readFloat64,
  readInt16,
  readInt32,
  readInt64,
  readInt8,
  readUint16,
  readUint32,
  readUint64,
  readUint8,
  toBinary,
  entropy,
  bytesToAscii,
} from "@/lib/hex-utils";

interface Row {
  label: string;
  hex: string;
  value: string;
  group: string;
}

export default function DataInspector() {
  const { bytes, cursor, selectionStart, selectionEnd, endianness } = useHexStore();

  const rows = useMemo<Row[]>(() => {
    if (!bytes) return [];
    const off = cursor;
    const newRows: Row[] = [];

    const safe = (n: number) => n + off < bytes.length;
    const grab = (n: number) => bytes.subarray(off, Math.min(off + n, bytes.length));

    if (safe(1)) {
      newRows.push({
        label: "UInt8",
        group: "Integer",
        hex: bytesToHex(grab(1)),
        value: readUint8(bytes, off).toString(),
      });
      newRows.push({
        label: "Int8",
        group: "Integer",
        hex: bytesToHex(grab(1)),
        value: readInt8(bytes, off).toString(),
      });
    }
    if (safe(2)) {
      newRows.push({
        label: `UInt16 ${endianness === "little" ? "LE" : "BE"}`,
        group: "Integer",
        hex: bytesToHex(grab(2)),
        value: readUint16(bytes, off, endianness).toString(),
      });
      newRows.push({
        label: `Int16 ${endianness === "little" ? "LE" : "BE"}`,
        group: "Integer",
        hex: bytesToHex(grab(2)),
        value: readInt16(bytes, off, endianness).toString(),
      });
    }
    if (safe(4)) {
      newRows.push({
        label: `UInt32 ${endianness === "little" ? "LE" : "BE"}`,
        group: "Integer",
        hex: bytesToHex(grab(4)),
        value: readUint32(bytes, off, endianness).toString(),
      });
      newRows.push({
        label: `Int32 ${endianness === "little" ? "LE" : "BE"}`,
        group: "Integer",
        hex: bytesToHex(grab(4)),
        value: readInt32(bytes, off, endianness).toString(),
      });
      newRows.push({
        label: "Float32",
        group: "Float",
        hex: bytesToHex(grab(4)),
        value: readFloat32(bytes, off, endianness).toFixed(6),
      });
    }
    if (safe(8)) {
      newRows.push({
        label: `UInt64 ${endianness === "little" ? "LE" : "BE"}`,
        group: "Integer",
        hex: bytesToHex(grab(8)),
        value: readUint64(bytes, off, endianness).toString(),
      });
      newRows.push({
        label: `Int64 ${endianness === "little" ? "LE" : "BE"}`,
        group: "Integer",
        hex: bytesToHex(grab(8)),
        value: readInt64(bytes, off, endianness).toString(),
      });
      newRows.push({
        label: "Float64 (double)",
        group: "Float",
        hex: bytesToHex(grab(8)),
        value: readFloat64(bytes, off, endianness).toFixed(10),
      });
    }

    // Binary
    if (safe(1)) {
      newRows.push({
        label: "Binary (8-bit)",
        group: "Bits",
        hex: bytesToHex(grab(1)),
        value: toBinary(readUint8(bytes, off), 8),
      });
    }
    if (safe(2)) {
      newRows.push({
        label: "Binary (16-bit)",
        group: "Bits",
        hex: bytesToHex(grab(2)),
        value: toBinary(readUint16(bytes, off, endianness), 16),
      });
    }
    if (safe(4)) {
      newRows.push({
        label: "Binary (32-bit)",
        group: "Bits",
        hex: bytesToHex(grab(4)),
        value: toBinary(readUint32(bytes, off, endianness), 32).match(/.{1,8}/g)?.join(" ") || "",
      });
    }

    // Selection stats
    if (selectionEnd > selectionStart) {
      const sel = bytes.subarray(selectionStart, selectionEnd);
      newRows.push({
        label: "Selection Length",
        group: "Selection",
        hex: "-",
        value: `${sel.length} bytes`,
      });
      newRows.push({
        label: "Selection Entropy",
        group: "Selection",
        hex: "-",
        value: `${entropy(sel).toFixed(4)} bits/byte`,
      });
      const preview = sel.length > 64 ? sel.subarray(0, 64) : sel;
      newRows.push({
        label: "Selection ASCII",
        group: "Selection",
        hex: bytesToHex(preview),
        value: bytesToAscii(preview),
      });
    }

    return newRows;
  }, [bytes, cursor, selectionStart, selectionEnd, endianness]);

  if (!bytes) {
    return <div className="text-muted-foreground text-sm p-4">No data loaded.</div>;
  }

  const groups = Array.from(new Set(rows.map((r) => r.group)));

  return (
    <div className="text-xs font-mono">
      <div className="px-3 py-2 border-b bg-muted/40">
        <div className="flex justify-between text-muted-foreground">
          <span>Cursor</span>
          <span>
            0x{formatOffset(cursor)} ({cursor})
          </span>
        </div>
      </div>
      <div className="overflow-y-auto max-h-[60vh]">
        {groups.map((g) => (
          <div key={g} className="border-b">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/30">
              {g}
            </div>
            {rows
              .filter((r) => r.group === g)
              .map((r, i) => (
                <div
                  key={`${g}-${i}`}
                  className="grid grid-cols-[120px_90px_1fr] gap-2 px-3 py-1 hover:bg-accent/30"
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{r.hex}</span>
                  <span className="truncate font-semibold">{r.value}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
