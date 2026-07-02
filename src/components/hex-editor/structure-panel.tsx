"use client";

import { useMemo, useState } from "react";
import { useHexStore } from "@/lib/hex-store";
import { detectTemplate, FILE_TEMPLATES, type ParsedField } from "@/lib/file-templates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatOffset } from "@/lib/hex-utils";
import { Boxes, ChevronRight } from "lucide-react";

export default function StructurePanel() {
  const { bytes, setSelection, setCursor, setHighlightRange } = useHexStore();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("auto");

  const detected = useMemo(() => (bytes ? detectTemplate(bytes) : null), [bytes]);

  // Pick effective template based on selection
  const effectiveTemplate = useMemo(() => {
    if (!bytes) return null;
    if (selectedTemplate === "auto") return detected;
    return FILE_TEMPLATES.find((t) => t.id === selectedTemplate) || null;
  }, [bytes, selectedTemplate, detected]);

  // Parsing is synchronous, so we can use useMemo directly
  const parsedFields = useMemo<ParsedField[]>(() => {
    if (!bytes || !effectiveTemplate) return [];
    try {
      return effectiveTemplate.parse(bytes);
    } catch (e) {
      console.error("Parse error", e);
      return [];
    }
  }, [bytes, effectiveTemplate]);

  const jumpTo = (offset: number, size: number) => {
    setCursor(offset);
    setSelection(offset, offset + size);
    setHighlightRange({ start: offset, end: offset + size, color: "#3b82f6" });
  };

  if (!bytes) {
    return <div className="text-muted-foreground text-sm p-4">No file loaded.</div>;
  }

  const fieldHighlights = parsedFields.map((f) => ({
    offset: f.offset,
    size: f.size,
    color: f.color || "#7c3aed",
    name: f.name,
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Boxes className="h-4 w-4" />
            File Structure
          </div>
          {detected && selectedTemplate === "auto" && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400">
              Detected: {detected.name}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Template</Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect{detected ? ` (${detected.name})` : ""}</SelectItem>
              {FILE_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs w-full"
            onClick={() => {
              // expose highlights globally by storing in a window property the hex view reads via prop
              const evt = new CustomEvent("hex-field-highlights", { detail: fieldHighlights });
              window.dispatchEvent(evt);
            }}
          >
            Highlight Fields in Hex View
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {parsedFields.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground italic">
              No structure to display. Select a template or load a recognizable file.
            </div>
          )}
          {parsedFields.map((f, i) => (
            <button
              key={i}
              onClick={() => jumpTo(f.offset, f.size)}
              className="w-full text-left p-2 hover:bg-accent/40 group"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-1 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: f.color || "#7c3aed" }}
                />
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  0x{formatOffset(f.offset)}
                </span>
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  +{f.size}B
                </span>
                <span className="text-xs font-semibold truncate flex-1">{f.name}</span>
              </div>
              <div className="ml-9 mt-0.5 text-xs flex items-baseline gap-2">
                <span
                  className="font-mono break-all"
                  style={{ color: f.color || "inherit" }}
                >
                  {f.value.kind === "ascii" || f.value.kind === "hex" || f.value.kind === "bytes"
                    ? f.value.value
                    : f.value.kind === "uint64" || f.value.kind === "int64"
                    ? f.value.value.toString()
                    : f.value.value.toString()}
                </span>
                {f.description && (
                  <span className="text-muted-foreground text-[10px] italic">{f.description}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
