"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  FolderOpen,
  Moon,
  Sun,
  Copy,
  Clipboard,
  Download,
  ArrowRightToLine,
  Settings2,
  Lock,
  Unlock,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useHexStore } from "@/lib/hex-store";
import { guessMime } from "@/lib/file-templates";
import { formatOffset, hexToBytes, bytesToHex } from "@/lib/hex-utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ToolbarProps {
  onSelectionChange?: (start: number, end: number) => void;
}

export default function Toolbar({ onSelectionChange }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const {
    bytes,
    fileName,
    fileSize,
    selectionStart,
    selectionEnd,
    bytesPerRow,
    bytesPerGroup,
    endianness,
    encoding,
    showAscii,
    showOffset,
    readOnly,
    setBytes,
    setSelection,
    setCursor,
    setBytesPerRow,
    setBytesPerGroup,
    setEndianness,
    setEncoding,
    setShowAscii,
    setShowOffset,
    setReadOnly,
  } = useHexStore();

  const openFile = useCallback(
    async (file: File) => {
      const ab = await file.arrayBuffer();
      const u8 = new Uint8Array(ab);
      const mime = guessMime(file);
      setBytes(u8, file.name, mime);
      toast.success(`Loaded ${file.name} (${u8.length.toLocaleString()} bytes)`);
    },
    [setBytes]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) openFile(f);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) openFile(f);
  };

  const jumpToOffset = () => {
    if (!bytes) return;
    const input = prompt("Jump to offset (hex like 0x1A2B or decimal):");
    if (!input) return;
    let off: number;
    const trimmed = input.trim();
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      off = parseInt(trimmed.slice(2), 16);
    } else if (/^[0-9a-fA-F]{6,}$/.test(trimmed)) {
      off = parseInt(trimmed, 16);
    } else if (/^\d+$/.test(trimmed)) {
      off = parseInt(trimmed, 10);
    } else {
      toast.error("Invalid offset. Use hex (0x1A2B) or decimal.");
      return;
    }
    off = Math.max(0, Math.min(bytes.length - 1, off));
    setCursor(off);
    setSelection(off, off + 1);
    onSelectionChange?.(off, off + 1);
    toast.success(`Jumped to 0x${formatOffset(off)}`);
  };

  const copySelectionHex = () => {
    if (!bytes || selectionEnd <= selectionStart) {
      toast.error("No selection to copy");
      return;
    }
    const sel = bytes.subarray(selectionStart, selectionEnd);
    navigator.clipboard.writeText(bytesToHex(sel, " "));
    toast.success(`Copied ${sel.length} bytes as hex`);
  };

  const copySelectionAscii = () => {
    if (!bytes || selectionEnd <= selectionStart) {
      toast.error("No selection to copy");
      return;
    }
    const sel = bytes.subarray(selectionStart, selectionEnd);
    let s = "";
    for (let i = 0; i < sel.length; i++) {
      const b = sel[i];
      s += b >= 32 && b <= 126 ? String.fromCharCode(b) : ".";
    }
    navigator.clipboard.writeText(s);
    toast.success(`Copied ${sel.length} bytes as ASCII`);
  };

  const pasteBytes = async () => {
    if (!bytes) return;
    const text = await navigator.clipboard.readText();
    try {
      // Detect if it's hex or text
      const cleaned = text.replace(/\s+/g, "");
      let newBytes: Uint8Array;
      if (/^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length % 2 === 0) {
        newBytes = hexToBytes(text);
      } else {
        newBytes = new TextEncoder().encode(text);
      }
      if (readOnly) {
        toast.error("Read-only mode is on. Toggle it off to paste.");
        return;
      }
      // For now we just show a preview — actual insertion would require restructuring
      const next = new Uint8Array(bytes.length + newBytes.length);
      next.set(bytes.subarray(0, selectionStart), 0);
      next.set(newBytes, selectionStart);
      next.set(bytes.subarray(selectionStart), selectionStart + newBytes.length);
      setBytes(next, fileName, useHexStore.getState().fileType);
      setSelection(selectionStart, selectionStart + newBytes.length);
      toast.success(`Pasted ${newBytes.length} bytes at offset 0x${formatOffset(selectionStart)}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const downloadFile = () => {
    if (!bytes) return;
    const blob = new Blob([bytes.slice().buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? `edited-${fileName}` : "edited.bin";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File downloaded");
  };

  return (
    <div
      className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 flex items-center gap-2 flex-wrap"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileInput}
        className="hidden"
      />
      <Button size="sm" variant="default" onClick={() => fileInputRef.current?.click()}>
        <FolderOpen className="h-4 w-4 mr-1" />
        Open File
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button size="sm" variant="outline" onClick={jumpToOffset} disabled={!bytes}>
        <ArrowRightToLine className="h-4 w-4 mr-1" />
        Jump
      </Button>
      <Button size="sm" variant="outline" onClick={copySelectionHex} disabled={!bytes}>
        <Copy className="h-4 w-4 mr-1" />
        Copy Hex
      </Button>
      <Button size="sm" variant="outline" onClick={copySelectionAscii} disabled={!bytes}>
        <Copy className="h-4 w-4 mr-1" />
        Copy ASCII
      </Button>
      <Button size="sm" variant="outline" onClick={pasteBytes} disabled={!bytes}>
        <Clipboard className="h-4 w-4 mr-1" />
        Paste
      </Button>
      <Button size="sm" variant="outline" onClick={downloadFile} disabled={!bytes}>
        <Download className="h-4 w-4 mr-1" />
        Save
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        size="sm"
        variant={readOnly ? "outline" : "default"}
        onClick={() => setReadOnly(!readOnly)}
        title={readOnly ? "Read-only mode" : "Edit mode (overwrite)"}
      >
        {readOnly ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        <span className="ml-1 hidden sm:inline">{readOnly ? "Read-only" : "Editing"}</span>
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Settings2 className="h-4 w-4 mr-1" />
            View
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Layout</DropdownMenuLabel>
          <div className="px-2 py-1 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show offset</Label>
              <Switch checked={showOffset} onCheckedChange={setShowOffset} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show ASCII</Label>
              <Switch checked={showAscii} onCheckedChange={setShowAscii} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Bytes per row</Label>
              <Select value={String(bytesPerRow)} onValueChange={(v) => setBytesPerRow(parseInt(v))}>
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[8, 16, 24, 32, 48, 64].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Group size</Label>
              <Select value={String(bytesPerGroup)} onValueChange={(v) => setBytesPerGroup(parseInt(v))}>
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 4, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}B
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Interpretation</DropdownMenuLabel>
          <div className="px-2 py-1 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Endianness</Label>
              <Select value={endianness} onValueChange={(v) => setEndianness(v as "little" | "big")}>
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="little">Little</SelectItem>
                  <SelectItem value="big">Big</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Encoding</Label>
              <Select value={encoding} onValueChange={(v) => setEncoding(v as typeof encoding)}>
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ascii">ASCII</SelectItem>
                  <SelectItem value="latin1">Latin-1</SelectItem>
                  <SelectItem value="utf8">UTF-8</SelectItem>
                  <SelectItem value="utf16le">UTF-16 LE</SelectItem>
                  <SelectItem value="utf16be">UTF-16 BE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        {bytes && (
          <div className="text-xs text-muted-foreground font-mono hidden md:block">
            {fileName} · {fileSize.toLocaleString()} B · sel{" "}
            {selectionEnd > selectionStart ? `${selectionEnd - selectionStart}B` : "1B"} @{" "}
            0x{formatOffset(selectionStart)}
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title="Toggle theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
