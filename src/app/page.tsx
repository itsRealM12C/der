"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import Toolbar from "@/components/hex-editor/toolbar";
import {
  Binary,
  FileSearch,
  FileText,
  Hash,
  Music,
  Boxes,
  Film,
  PanelRight,
  PanelRightClose,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHexStore } from "@/lib/hex-store";

// Dynamically import heavy components to keep initial bundle small.
const HexView = dynamic(
  () => import("@/components/hex-editor/hex-view").then((m) => m.default),
  { ssr: false }
);
const DataInspector = dynamic(
  () => import("@/components/hex-editor/data-inspector").then((m) => m.default),
  { ssr: false }
);
const SearchPanel = dynamic(
  () => import("@/components/hex-editor/search-panel").then((m) => m.default),
  { ssr: false }
);
const ChecksumPanel = dynamic(
  () => import("@/components/hex-editor/checksum-panel").then((m) => m.default),
  { ssr: false }
);
const StructurePanel = dynamic(
  () => import("@/components/hex-editor/structure-panel").then((m) => m.default),
  { ssr: false }
);
const AudioPanel = dynamic(
  () => import("@/components/hex-editor/audio-panel").then((m) => m.default),
  { ssr: false }
);
const VideoPanel = dynamic(
  () => import("@/components/hex-editor/video-panel").then((m) => m.default),
  { ssr: false }
);
const FileInfoPanel = dynamic(
  () => import("@/components/hex-editor/file-info-panel").then((m) => m.default),
  { ssr: false }
);

export default function Home() {
  const { bytes, fileName, fileType } = useHexStore();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [fieldHighlights, setFieldHighlights] = useState<
    { offset: number; size: number; color: string; name: string }[]
  >([]);

  // Listen for highlight events from the structure panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as typeof fieldHighlights;
      setFieldHighlights(detail);
    };
    window.addEventListener("hex-field-highlights", handler);
    return () => window.removeEventListener("hex-field-highlights", handler);
  }, []);

  // Auto-detect if audio/video for tab selection convenience
  const isAudio =
    fileType.startsWith("audio/") || /\.(wav|mp3|flac|ogg|oga|m4a|aac|opus)$/i.test(fileName);
  const isVideo =
    fileType.startsWith("video/") || /\.(mp4|m4v|webm|mov|avi|mkv|ogv)$/i.test(fileName);

  return (
    <main className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="border-b bg-gradient-to-r from-emerald-950/40 via-background to-background px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
            <Binary className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none">HexForge</h1>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
              Advanced Web Hex Editor &amp; Reverse Engineering Toolkit
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          title={rightPanelOpen ? "Hide inspector" : "Show inspector"}
        >
          {rightPanelOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRight className="h-4 w-4" />
          )}
        </Button>
      </header>

      <Toolbar />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={62} minSize={35}>
            <div className="h-full border-r">
              <HexView fieldHighlights={fieldHighlights} />
            </div>
          </ResizablePanel>
          {rightPanelOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={38} minSize={25}>
                <Tabs defaultValue="inspector" className="h-full flex flex-col">
                  <div className="border-b px-2 pt-2">
                    <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 h-auto">
                      <TabsTrigger value="inspector" className="text-xs py-1.5">
                        <Binary className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Inspect</span>
                      </TabsTrigger>
                      <TabsTrigger value="info" className="text-xs py-1.5">
                        <FileText className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Info</span>
                      </TabsTrigger>
                      <TabsTrigger value="search" className="text-xs py-1.5">
                        <FileSearch className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Search</span>
                      </TabsTrigger>
                      <TabsTrigger value="hashes" className="text-xs py-1.5">
                        <Hash className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Hashes</span>
                      </TabsTrigger>
                      <TabsTrigger value="structure" className="text-xs py-1.5">
                        <Boxes className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Structure</span>
                      </TabsTrigger>
                      <TabsTrigger value="audio" className="text-xs py-1.5" disabled={!bytes}>
                        <Music className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Audio</span>
                      </TabsTrigger>
                      <TabsTrigger value="video" className="text-xs py-1.5" disabled={!bytes}>
                        <Film className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Video</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <TabsContent value="inspector" className="mt-0 h-full overflow-y-auto">
                      <DataInspector />
                    </TabsContent>
                    <TabsContent value="info" className="mt-0 h-full overflow-y-auto">
                      <FileInfoPanel />
                    </TabsContent>
                    <TabsContent value="search" className="mt-0 h-full">
                      <SearchPanel />
                    </TabsContent>
                    <TabsContent value="hashes" className="mt-0 h-full overflow-y-auto">
                      <ChecksumPanel />
                    </TabsContent>
                    <TabsContent value="structure" className="mt-0 h-full">
                      <StructurePanel />
                    </TabsContent>
                    <TabsContent
                      value="audio"
                      className="mt-0 h-full overflow-y-auto"
                      forceMount={isAudio}
                    >
                      <AudioPanel />
                    </TabsContent>
                    <TabsContent
                      value="video"
                      className="mt-0 h-full overflow-y-auto"
                      forceMount={isVideo}
                    >
                      <VideoPanel />
                    </TabsContent>
                  </div>
                </Tabs>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {!bytes && (
        <div className="absolute inset-0 top-[88px] flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-md p-6 rounded-lg border-2 border-dashed border-border bg-background/80 backdrop-blur pointer-events-auto">
            <Binary className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Drop a file to begin</h2>
            <p className="text-sm text-muted-foreground">
              Drag and drop any file anywhere, or click <strong>Open File</strong> in the toolbar.
              All processing happens in your browser — nothing is uploaded.
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] text-muted-foreground">
              <div className="rounded border p-2">Hex view<br/>with editing</div>
              <div className="rounded border p-2">Audio waveform<br/>& spectrogram</div>
              <div className="rounded border p-2">Video frame<br/>extraction</div>
              <div className="rounded border p-2">File structure<br/>templates</div>
              <div className="rounded border p-2">CRC/MD5/SHA<br/>checksums</div>
              <div className="rounded border p-2">String extraction<br/>& search</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
