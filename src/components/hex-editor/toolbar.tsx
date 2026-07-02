"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
  LayoutPanelLeft,
  LayoutPanelTop,
  LayoutGrid,
  Maximize,
  Minimize2,
  Type,
  MoreHorizontal,
  PanelRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useHexStore, type LayoutMode, type FontScale } from "@/lib/hex-store";
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
import { useViewport, autoBytesPerRow } from "@/lib/use-viewport";

interface ToolbarProps {
  onSelectionChange?: (start: number, end: number) => void;
  /** Optional callback when user requests the mobile inspector to open. */
  onOpenMobileInspector?: () => void;
}

const LAYOUT_OPTIONS: { value: LayoutMode; label: string; icon: React.ReactNode; hint: string }[] = [
  {
    value: "split-h",
    label: "Split Horizontal",
    icon: <LayoutPanelLeft className="h-4 w-4" />,
    hint: "Hex left, inspector right (desktop)",
  },
  {
    value: "split-v",
    label: "Split Vertical",
    icon: <LayoutPanelTop className="h-4 w-4" />,
    hint: "Hex top, inspector bottom (mobile)",
  },
  {
    value: "stacked",
    label: "Stacked",
    icon: <LayoutGrid className="h-4 w-4" />,
    hint: "Hex above inspector, scrollable",
  },
  {
    value: "focus",
    label: "Focus Mode",
    icon: <Maximize className="h-4 w-4" />,
    hint: "Hex only, inspector hidden",
  },
  {
    value: "compact",
    label: "Compact",
    icon: <Minimize2 className="h-4 w-4" />,
    hint: "Dense hex view, smaller fonts",
  },
];

const FONT_SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: "xs", label: "XS (10px)" },
  { value: "sm", label: "S (11px)" },
  { value: "md", label: "M (12px)" },
  { value: "lg", label: "L (14px)" },
];

export default function Toolbar({ onSelectionChange, onOpenMobileInspector }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const viewport = useViewport();
  const isMobile = viewport.isMobile;

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
    layoutMode,
    fontScale,
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
    setLayoutMode,
    setFontScale,
  } = useHexStore();

  // Sync <html> data attributes from the store.
  // On first mount, COMPUTE the right defaults from the current viewport
  // (this is more reliable than relying on the inline ScalingScript — it
  // can be overridden by hydration timing on slow connections).
  const adoptedRef = useRef(false);
  useEffect(() => {
    const html = document.documentElement;
    if (!adoptedRef.current) {
      adoptedRef.current = true;
      const w = window.innerWidth;
      // Compute viewport-aware defaults
      const computedFs: FontScale =
        w < 480 ? "xs" : w < 768 ? "sm" : w < 1440 ? "md" : "lg";
      const computedLm: LayoutMode = w < 768 ? "split-v" : "split-h";
      // Only adopt if user hasn't explicitly changed from the default yet
      // (we can't tell, so adopt unconditionally on first mount — store
      // default is "md"/"split-h" so this matches desktop).
      if (computedFs !== fontScale) {
        setFontScale(computedFs);
      }
      if (computedLm !== layoutMode) {
        setLayoutMode(computedLm);
      }
      // Always write to <html> immediately to avoid flash
      html.setAttribute("data-font-scale", computedFs);
      html.setAttribute("data-layout-mode", computedLm);
      return;
    }
    html.setAttribute("data-font-scale", fontScale);
    html.setAttribute("data-layout-mode", layoutMode);
  }, []);

  // After initial adoption, write back to <html> whenever the store changes.
  useEffect(() => {
    if (!adoptedRef.current) return;
    const html = document.documentElement;
    html.setAttribute("data-font-scale", fontScale);
    html.setAttribute("data-layout-mode", layoutMode);
  }, [fontScale, layoutMode]);

  // Keep viewport + DPR attributes fresh (read by CSS for scaling).
  useEffect(() => {
    const html = document.documentElement;
    const vp = isMobile ? "mobile" : viewport.isTablet ? "tablet" : "desktop";
    html.setAttribute("data-viewport", vp);
    html.setAttribute("data-dpr", String(viewport.devicePixelRatio));
  }, [viewport.isMobile, viewport.isTablet, viewport.devicePixelRatio, isMobile]);

  // Auto-fit bytes-per-row on viewport width or font scale change (mobile only).
  // On desktop, respect the user's manual selection.
  useEffect(() => {
    if (!isMobile) return;
    const fitted = autoBytesPerRow(viewport.width, fontScale);
    if (fitted !== bytesPerRow) {
      setBytesPerRow(fitted);
    }
  }, [viewport.width, fontScale, isMobile, bytesPerRow]);

  // Auto-switch layout mode when crossing the mobile breakpoint.
  useEffect(() => {
    if (isMobile && (layoutMode === "split-h" || layoutMode === "stacked")) {
      setLayoutMode("split-v");
    }
  }, [isMobile, layoutMode, setLayoutMode]);

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
    const input = window.prompt("Jump to offset (hex like 0x1A2B or decimal):");
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
    navigator.clipboard.writeText(bytesToHex(sel, " ")).catch(() => {
      toast.error("Clipboard write failed");
    });
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
    navigator.clipboard.writeText(s).catch(() => {
      toast.error("Clipboard write failed");
    });
    toast.success(`Copied ${sel.length} bytes as ASCII`);
  };

  const pasteBytes = async () => {
    if (!bytes) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error("Clipboard read denied. Some browsers require HTTPS or a user gesture.");
      return;
    }
    try {
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

  // Layout switcher dropdown (shared between mobile and desktop)
  const layoutMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" title="Layout">
          <LayoutModeIcon mode={layoutMode} />
          <span className="ml-1 hidden lg:inline">Layout</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Layout Mode</DropdownMenuLabel>
        {LAYOUT_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setLayoutMode(opt.value)}
            className="flex items-start gap-2 cursor-pointer"
          >
            <span className="mt-0.5">{opt.icon}</span>
            <div className="flex flex-col">
              <span className="font-medium">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
            </div>
            {layoutMode === opt.value && (
              <span className="ml-auto text-emerald-500 text-xs">●</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Font Scale</DropdownMenuLabel>
        <div className="px-2 py-1">
          <Select value={fontScale} onValueChange={(v) => setFontScale(v as FontScale)}>
            <SelectTrigger className="h-8 text-xs">
              <Type className="h-3 w-3 mr-1 inline" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SCALE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // View settings dropdown (bytes per row, group, endianness, encoding)
  const viewMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" title="View settings">
          <Settings2 className="h-4 w-4" />
          <span className="ml-1 hidden lg:inline">View</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-h-[80vh] overflow-y-auto">
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
                {[4, 8, 12, 16, 24, 32, 48, 64].map((n) => (
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
  );

  // Mobile: condensed toolbar — primary actions + overflow menu
  if (isMobile) {
    return (
      <div
        className="border-b bg-background/95 backdrop-blur p-2 flex items-center gap-1.5 overflow-x-auto tab-strip safe-top"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{ minHeight: "var(--toolbar-height)" }}
      >
        <input ref={fileInputRef} type="file" onChange={handleFileInput} className="hidden" />
        <Button size="sm" variant="default" onClick={() => fileInputRef.current?.click()} className="shrink-0">
          <FolderOpen className="h-4 w-4" />
          <span className="ml-1">Open</span>
        </Button>
        <Button
          size="sm"
          variant={readOnly ? "outline" : "default"}
          onClick={() => setReadOnly(!readOnly)}
          className="shrink-0"
          title={readOnly ? "Read-only mode" : "Edit mode (overwrite)"}
        >
          {readOnly ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </Button>
        {layoutMenu}
        {viewMenu}
        <Button
          size="sm"
          variant="outline"
          onClick={jumpToOffset}
          disabled={!bytes}
          className="shrink-0"
          title="Jump to offset"
        >
          <ArrowRightToLine className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={downloadFile}
          disabled={!bytes}
          className="shrink-0"
          title="Download edited file"
        >
          <Download className="h-4 w-4" />
        </Button>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {/* Overflow menu on mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" title="More">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={copySelectionHex} disabled={!bytes}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Hex
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copySelectionAscii} disabled={!bytes}>
                <Copy className="h-4 w-4 mr-2" />
                Copy ASCII
              </DropdownMenuItem>
              <DropdownMenuItem onClick={pasteBytes} disabled={!bytes}>
                <Clipboard className="h-4 w-4 mr-2" />
                Paste
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onOpenMobileInspector?.()}
                disabled={!bytes}
              >
                <PanelRight className="h-4 w-4 mr-2" />
                Open Inspector
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // Desktop: full toolbar (existing + new layout menu)
  return (
    <div
      className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 flex items-center gap-2 flex-wrap"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{ minHeight: "var(--toolbar-height)" }}
    >
      <input ref={fileInputRef} type="file" onChange={handleFileInput} className="hidden" />
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

      {layoutMenu}
      {viewMenu}

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

function LayoutModeIcon({ mode }: { mode: LayoutMode }) {
  switch (mode) {
    case "split-h":
      return <LayoutPanelLeft className="h-4 w-4" />;
    case "split-v":
      return <LayoutPanelTop className="h-4 w-4" />;
    case "stacked":
      return <LayoutGrid className="h-4 w-4" />;
    case "focus":
      return <Maximize className="h-4 w-4" />;
    case "compact":
      return <Minimize2 className="h-4 w-4" />;
  }
}
