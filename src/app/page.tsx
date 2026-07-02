"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import Toolbar from "@/components/hex-editor/toolbar";
import { DesktopInspector } from "@/components/hex-editor/desktop-inspector";
import { MobileInspector } from "@/components/hex-editor/mobile-inspector";
import { Binary, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHexStore } from "@/lib/hex-store";
import { useViewport } from "@/lib/use-viewport";

// Dynamically import heavy components to keep initial bundle small.
const HexView = dynamic(
  () => import("@/components/hex-editor/hex-view").then((m) => m.default),
  { ssr: false }
);

export default function Home() {
  const {
    bytes,
    fileName,
    fileType,
    layoutMode,
    mobileInspectorOpen,
    setMobileInspectorOpen,
    mobileTab,
    setMobileTab,
  } = useHexStore();
  const viewport = useViewport();
  const [fieldHighlights, setFieldHighlights] = useState<
    { offset: number; size: number; color: string; name: string }[]
  >([]);
  const [desktopTab, setDesktopTab] = useState("inspector");

  // Listen for highlight events from the structure panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as typeof fieldHighlights;
      setFieldHighlights(detail);
    };
    window.addEventListener("hex-field-highlights", handler);
    return () => window.removeEventListener("hex-field-highlights", handler);
  }, []);

  const isAudio =
    fileType.startsWith("audio/") || /\.(wav|mp3|flac|ogg|oga|m4a|aac|opus)$/i.test(fileName);
  const isVideo =
    fileType.startsWith("video/") || /\.(mp4|m4v|webm|mov|avi|mkv|ogv)$/i.test(fileName);

  const showMobileInspectorButton = viewport.isMobile && bytes;

  // Effective layout: on mobile, force split-v (hex above, sheet below)
  const effectiveLayout = viewport.isMobile ? "split-v" : layoutMode;

  return (
    <main className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      <header
        className="border-b bg-gradient-to-r from-emerald-950/40 via-background to-background px-3 sm:px-4 py-2 flex items-center justify-between shrink-0"
        style={{ minHeight: "var(--header-height)" }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
            <Binary className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-none truncate">HexForge</h1>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5 hidden sm:block">
              Advanced Web Hex Editor &amp; Reverse Engineering Toolkit
            </p>
          </div>
        </div>
        {showMobileInspectorButton && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMobileInspectorOpen(true)}
            title="Open inspector"
            className="shrink-0"
          >
            <PanelRight className="h-4 w-4" />
            <span className="ml-1 text-xs">Inspect</span>
          </Button>
        )}
      </header>

      <Toolbar onSelectionChange={() => {}} onOpenMobileInspector={() => setMobileInspectorOpen(true)} />

      <div className="flex-1 min-h-0">
        {/* ---------------- Layout: split-h (default desktop) ---------------- */}
        {effectiveLayout === "split-h" && (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={62} minSize={35}>
              <div className="h-full border-r">
                <HexView fieldHighlights={fieldHighlights} />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={38} minSize={25}>
              <DesktopInspector
                fieldHighlights={fieldHighlights}
                tab={desktopTab}
                onTabChange={setDesktopTab}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {/* ---------------- Layout: split-v (hex top, inspector bottom) ---------------- */}
        {effectiveLayout === "split-v" && (
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={55} minSize={25}>
              <div className="h-full border-b">
                <HexView fieldHighlights={fieldHighlights} />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={20}>
              <DesktopInspector
                fieldHighlights={fieldHighlights}
                tab={desktopTab}
                onTabChange={setDesktopTab}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {/* ---------------- Layout: stacked (no resize handle, scroll) ---------------- */}
        {effectiveLayout === "stacked" && (
          <div className="h-full overflow-auto hex-scroll">
            <div className="h-[60vh] border-b">
              <HexView fieldHighlights={fieldHighlights} />
            </div>
            <div className="h-[60vh]">
              <DesktopInspector
                fieldHighlights={fieldHighlights}
                tab={desktopTab}
                onTabChange={setDesktopTab}
              />
            </div>
          </div>
        )}

        {/* ---------------- Layout: focus (hex only) ---------------- */}
        {effectiveLayout === "focus" && (
          <div className="h-full">
            <HexView fieldHighlights={fieldHighlights} />
          </div>
        )}

        {/* ---------------- Layout: compact (denser, hex + inspector) ---------------- */}
        {effectiveLayout === "compact" && (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={70} minSize={40}>
              <div className="h-full border-r">
                <HexView fieldHighlights={fieldHighlights} />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={20}>
              <DesktopInspector
                fieldHighlights={fieldHighlights}
                tab={desktopTab}
                onTabChange={setDesktopTab}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {/* Mobile inspector sheet (slides up from bottom) */}
      <MobileInspector
        open={mobileInspectorOpen}
        onOpenChange={setMobileInspectorOpen}
        fieldHighlights={fieldHighlights}
      />

      {/* Empty-state overlay (only when no file loaded) */}
      {!bytes && (
        <div className="absolute inset-0 top-[88px] sm:top-[96px] flex items-center justify-center pointer-events-none p-4">
          <div className="text-center max-w-md p-4 sm:p-6 rounded-lg border-2 border-dashed border-border bg-background/80 backdrop-blur pointer-events-auto">
            <Binary className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-base sm:text-lg font-semibold mb-2">Drop a file to begin</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Drag &amp; drop anywhere, or tap <strong>Open</strong> in the toolbar.
              Everything stays in your browser — nothing is uploaded.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 text-[10px] text-muted-foreground">
              <div className="rounded border p-2">Hex view<br/>with editing</div>
              <div className="rounded border p-2">Audio waveform<br/>& spectrogram</div>
              <div className="rounded border p-2">Video frame<br/>extraction</div>
              <div className="rounded border p-2">File structure<br/>templates</div>
              <div className="rounded border p-2">CRC/MD5/SHA<br/>checksums</div>
              <div className="rounded border p-2">String extraction<br/>& search</div>
              <div className="rounded border p-2 col-span-2 sm:col-span-3 text-emerald-600 dark:text-emerald-400">
                <strong>NEW</strong> · HTML document parsing — load any .html file (incl. GitHub Pages sites) to inspect tags, scripts, styles, links, and inline JS/CSS with byte-accurate offsets
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
