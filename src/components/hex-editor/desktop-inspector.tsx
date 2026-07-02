"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Binary,
  FileSearch,
  FileText,
  Hash,
  Music,
  Boxes,
  Film,
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

interface DesktopInspectorProps {
  fieldHighlights?: { offset: number; size: number; color: string; name: string }[];
  /** Active tab value, controlled by parent. */
  tab: string;
  onTabChange: (t: string) => void;
}

/**
 * Desktop inspector — 7 tabs in a grid, fills the right panel.
 */
export function DesktopInspector({ fieldHighlights, tab, onTabChange }: DesktopInspectorProps) {
  const { bytes, fileName, fileType } = useHexStore();

  const isAudio =
    fileType.startsWith("audio/") || /\.(wav|mp3|flac|ogg|oga|m4a|aac|opus)$/i.test(fileName);
  const isVideo =
    fileType.startsWith("video/") || /\.(mp4|m4v|webm|mov|avi|mkv|ogv)$/i.test(fileName);

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="h-full flex flex-col">
      <div className="border-b px-2 pt-2 shrink-0">
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
        <TabsContent value="audio" className="mt-0 h-full overflow-y-auto" forceMount={isAudio}>
          <AudioPanel />
        </TabsContent>
        <TabsContent value="video" className="mt-0 h-full overflow-y-auto" forceMount={isVideo}>
          <VideoPanel />
        </TabsContent>
      </div>
    </Tabs>
  );
}
