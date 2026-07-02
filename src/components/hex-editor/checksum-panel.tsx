"use client";

import { useEffect, useState } from "react";
import { useHexStore } from "@/lib/hex-store";
import { computeAllHashes } from "@/lib/checksum";
import { formatSize } from "@/lib/hex-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function ChecksumPanel() {
  const { bytes, selectionStart, selectionEnd } = useHexStore();
  const [scope, setScope] = useState<"full" | "selection">("full");
  const [hashes, setHashes] = useState<Record<string, string> | null>(null);
  const [computedKey, setComputedKey] = useState<string | null>(null);

  const targetBytes = bytes
    ? scope === "selection" && selectionEnd > selectionStart
      ? bytes.subarray(selectionStart, selectionEnd)
      : bytes
    : null;

  // Build a stable key for the current input so we know when to recompute
  const inputKey = targetBytes
    ? `${scope}:${targetBytes.byteLength}:${selectionStart}:${selectionEnd}`
    : null;
  const loading = inputKey !== null && inputKey !== computedKey;

  useEffect(() => {
    if (!targetBytes || inputKey === null || inputKey === computedKey) {
      return;
    }
    let cancelled = false;
    computeAllHashes(targetBytes).then((h) => {
      if (cancelled) return;
      setHashes(h);
      setComputedKey(inputKey);
    });
    return () => {
      cancelled = true;
    };
  }, [targetBytes, inputKey, computedKey]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (!bytes) {
    return <div className="text-muted-foreground text-sm p-4">No file loaded.</div>;
  }

  const isSelection = selectionEnd > selectionStart;

  const items: { label: string; value?: string; mono?: boolean; description?: string }[] = [
    {
      label: "Input Size",
      value: targetBytes ? formatSize(targetBytes.length) : undefined,
      description: `${targetBytes?.length.toLocaleString()} bytes`,
    },
    { label: "Byte Sum (mod 256)", value: hashes?.byteSum, mono: true },
    { label: "Adler-32", value: hashes?.adler32, mono: true },
    { label: "CRC-32", value: hashes?.crc32, mono: true },
    { label: "MD5", value: hashes?.md5, mono: true },
    { label: "SHA-1", value: hashes?.sha1, mono: true },
    { label: "SHA-256", value: hashes?.sha256, mono: true },
    { label: "SHA-512", value: hashes?.sha512, mono: true },
  ];

  return (
    <div className="p-3 space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Checksums &amp; Hashes
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="scope"
                checked={scope === "selection"}
                disabled={!isSelection}
                onCheckedChange={(v) => setScope(v ? "selection" : "full")}
              />
              <Label htmlFor="scope" className="text-xs text-muted-foreground">
                {scope === "selection" ? "Selection" : "Whole file"}
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {loading && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Computing hashes...
            </div>
          )}
          {!loading &&
            items.map((it) => (
              <div
                key={it.label}
                className="grid grid-cols-[140px_1fr_auto] gap-2 items-center py-1.5 border-b last:border-0"
              >
                <div className="text-xs text-muted-foreground">{it.label}</div>
                <div className={`text-xs ${it.mono ? "font-mono" : ""} truncate`}>
                  {it.value || "—"}
                  {it.description && (
                    <span className="text-muted-foreground ml-2">({it.description})</span>
                  )}
                </div>
                {it.value && it.mono && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => copy(it.value!, it.label)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
