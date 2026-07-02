"use client";

import { useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Binary,
  FileSearch,
  FileText,
  Hash,
  Music,
  Boxes,
  Film,
  Code2,
} from "lucide-react";
import { useHexStore } from "@/lib/hex-store";
import dynamic from "next/dynamic";

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
const HtmlPanel = dynamic(
  () => import("@/components/hex-editor/html-panel").then((m) => m.default),
  { ssr: false }
);

interface MobileInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldHighlights?: { offset: number; size: number; color: string; name: string }[];
}

/**
 * Bottom-sheet inspector for mobile. Slides up from the bottom and takes
 * ~85% of the screen height. Tab strip is horizontally scrollable.
 */
export function MobileInspector({ open, onOpenChange, fieldHighlights }: MobileInspectorProps) {
  const { bytes, fileName, fileType, mobileTab, setMobileTab } = useHexStore();

  const isAudio =
    fileType.startsWith("audio/") || /\.(wav|mp3|flac|ogg|oga|m4a|aac|opus)$/i.test(fileName);
  const isVideo =
    fileType.startsWith("video/") || /\.(mp4|m4v|webm|mov|avi|mkv|ogv)$/i.test(fileName);
  const isHtml =
    fileType.startsWith("text/html") ||
    fileType.startsWith("application/xhtml") ||
    /\.(html?|xhtml|xht)$/i.test(fileName);

  // Ensure a valid tab is selected when file changes
  useEffect(() => {
    if (!bytes) return;
    if (mobileTab === "audio" && !isAudio) setMobileTab("inspector");
    if (mobileTab === "video" && !isVideo) setMobileTab("inspector");
    if (mobileTab === "html" && !isHtml) setMobileTab("inspector");
  }, [bytes, isAudio, isVideo, isHtml, mobileTab, setMobileTab]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] p-0 flex flex-col safe-bottom"
        aria-label="Inspector panel"
      >
        <SheetHeader className="px-3 pt-3 pb-2 border-b shrink-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            Inspector
          </SheetTitle>
        </SheetHeader>
        <Tabs
          value={mobileTab}
          onValueChange={setMobileTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="border-b px-2 pt-2 shrink-0">
            <TabsList className="grid h-auto grid-cols-8 tab-strip overflow-x-auto">
              <TabsTrigger value="inspector" className="text-xs py-1.5 px-1">
                <Binary className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="info" className="text-xs py-1.5 px-1">
                <FileText className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="search" className="text-xs py-1.5 px-1">
                <FileSearch className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="hashes" className="text-xs py-1.5 px-1">
                <Hash className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="structure" className="text-xs py-1.5 px-1">
                <Boxes className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="html" className="text-xs py-1.5 px-1" disabled={!bytes || !isHtml}>
                <Code2 className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="audio" className="text-xs py-1.5 px-1" disabled={!bytes}>
                <Music className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="video" className="text-xs py-1.5 px-1" disabled={!bytes}>
                <Film className="h-3 w-3" />
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
            <TabsContent value="html" className="mt-0 h-full" forceMount={isHtml}>
              <HtmlPanel />
            </TabsContent>
            <TabsContent value="audio" className="mt-0 h-full overflow-y-auto" forceMount={isAudio}>
              <AudioPanel />
            </TabsContent>
            <TabsContent value="video" className="mt-0 h-full overflow-y-auto" forceMount={isVideo}>
              <VideoPanel />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
