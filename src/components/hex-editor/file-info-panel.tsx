"use client";

import { useMemo } from "react";
import { useHexStore } from "@/lib/hex-store";
import { formatSize, entropy } from "@/lib/hex-utils";
import { detectTemplate } from "@/lib/file-templates";
import { FileText, Hash, Binary, Database } from "lucide-react";

export default function FileInfoPanel() {
  const { bytes, fileName, fileSize, fileType } = useHexStore();

  const detected = useMemo(() => (bytes ? detectTemplate(bytes) : null), [bytes]);

  const byteFreq = useMemo(() => {
    if (!bytes) return null;
    const freq = new Array(256).fill(0);
    for (let i = 0; i < bytes.length; i++) freq[bytes[i]]++;
    return freq;
  }, [bytes]);

  const ent = useMemo(() => (bytes ? entropy(bytes) : 0), [bytes]);

  if (!bytes) {
    return <div className="text-muted-foreground text-sm p-4">No file loaded.</div>;
  }

  const mime = fileType || "application/octet-stream";
  const ext = fileName.split(".").pop() || "";

  // Top 8 byte values
  const topBytes = byteFreq
    ? [...byteFreq.map((c, i) => ({ byte: i, count: c })).filter((x) => x.count > 0)]
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    : [];

  // First 32 bytes preview
  const preview = bytes.subarray(0, Math.min(32, bytes.length));

  return (
    <div className="p-3 space-y-4 text-sm">
      <div>
        <div className="flex items-center gap-2 font-semibold mb-2">
          <FileText className="h-4 w-4" />
          File Overview
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs">
          <Stat label="File name" value={fileName || "(untitled)"} />
          <Stat label="File size" value={`${formatSize(fileSize)} (${fileSize.toLocaleString()} bytes)`} />
          <Stat label="MIME type" value={mime} />
          <Stat label="Extension" value={ext || "—"} />
          <Stat
            label="Detected format"
            value={detected ? detected.name : "Unknown"}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 font-semibold mb-2">
          <Hash className="h-4 w-4" />
          Entropy &amp; Byte Distribution
        </div>
        <div className="space-y-2 text-xs">
          <div className="rounded-md border p-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shannon entropy</span>
              <span className="font-mono">{ent.toFixed(4)} bits/byte</span>
            </div>
            <div className="h-2 bg-muted rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                style={{ width: `${(ent / 8) * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {ent < 4
                ? "Low — likely text or structured data, possibly compressible"
                : ent < 7
                ? "Medium — typical of mixed binary files"
                : "High — likely compressed, encrypted, or random data"}
            </div>
          </div>

          {byteFreq && (
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground mb-1">Byte frequency histogram (256 buckets)</div>
              <div className="flex items-end gap-px h-16">
                {byteFreq.map((c, i) => {
                  const max = Math.max(...byteFreq);
                  const h = max > 0 ? (c / max) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-emerald-500"
                      style={{ height: `${h}%`, minWidth: 0 }}
                      title={`0x${i.toString(16).padStart(2, "0")}: ${c.toLocaleString()}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0x00</span>
                <span>0xFF</span>
              </div>
            </div>
          )}

          <div className="rounded-md border p-2">
            <div className="text-muted-foreground mb-1">Top 8 byte values</div>
            <div className="space-y-1">
              {topBytes.map(({ byte, count }) => (
                <div key={byte} className="flex justify-between font-mono">
                  <span>0x{byte.toString(16).padStart(2, "0").toUpperCase()}</span>
                  <span>{count.toLocaleString()}</span>
                  <span className="text-muted-foreground">
                    {((count / fileSize) * 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 font-semibold mb-2">
          <Binary className="h-4 w-4" />
          First 32 Bytes
        </div>
        <div className="rounded-md border p-2 font-mono text-xs">
          <div className="text-emerald-600 dark:text-emerald-400 break-all">
            {Array.from(preview)
              .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
              .join(" ")}
          </div>
          <div className="text-muted-foreground mt-1 break-all">
            {Array.from(preview)
              .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
              .join("")}
          </div>
        </div>
      </div>

      {detected && (
        <div>
          <div className="flex items-center gap-2 font-semibold mb-2">
            <Database className="h-4 w-4" />
            Magic Signature
          </div>
          <div className="rounded-md border p-2 text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">Template: </span>
              {detected.name}
            </div>
            <div>
              <span className="text-muted-foreground">MIME: </span>
              {detected.mime.join(", ")}
            </div>
            <div className="text-muted-foreground">
              See the File Structure tab for parsed fields.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2 flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-right truncate ml-2">{value}</span>
    </div>
  );
}
