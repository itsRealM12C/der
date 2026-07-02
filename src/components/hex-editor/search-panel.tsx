"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHexStore } from "@/lib/hex-store";
import {
  extractStrings,
  findBytes,
  findText,
  formatOffset,
  hexToBytes,
} from "@/lib/hex-utils";
import { Search, FileText, Copy } from "lucide-react";
import { toast } from "sonner";

type SearchMode = "text" | "hex";

export default function SearchPanel() {
  const { bytes, setSelection, setCursor, setHighlightRange } = useHexStore();
  const [mode, setMode] = useState<SearchMode>("text");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);

  // String extraction
  const [minLength, setMinLength] = useState(4);
  const [strings, setStrings] = useState<{ offset: number; text: string }[]>([]);
  const [stringsKey, setStringsKey] = useState<string | null>(null);
  const stringsLoading =
    bytes !== null && stringsKey !== `${bytes.length}:${minLength}`;

  useEffect(() => {
    if (!bytes) {
      return;
    }
    const expectedKey = `${bytes.length}:${minLength}`;
    if (stringsKey === expectedKey) return;
    // auto-extract strings when bytes load
    const id = setTimeout(() => {
      const extracted = extractStrings(bytes, minLength);
      setStrings(extracted);
      setStringsKey(expectedKey);
    }, 50);
    return () => clearTimeout(id);
  }, [bytes, minLength, stringsKey]);

  const runSearch = () => {
    if (!bytes || !query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    setTimeout(() => {
      try {
        if (mode === "text") {
          setResults(findText(bytes, query));
        } else {
          const pattern = hexToBytes(query);
          setResults(findBytes(bytes, pattern));
        }
      } catch (e) {
        toast.error((e as Error).message);
        setResults([]);
      }
      setSearching(false);
    }, 0);
  };

  const jumpTo = (offset: number, length: number) => {
    setCursor(offset);
    setSelection(offset, offset + length);
    setHighlightRange({ start: offset, end: offset + length, color: "#3b82f6" });
    setTimeout(() => setHighlightRange(null), 1500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (!bytes) {
    return <div className="text-muted-foreground text-sm p-4">No file loaded.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-3 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Search Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text (UTF-8)</SelectItem>
              <SelectItem value="hex">Hex bytes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder={mode === "text" ? "Search text..." : "FF D8 FF E0 ..."}
            className="h-8 text-xs font-mono"
          />
          <Button size="sm" onClick={runSearch} disabled={searching} className="h-8">
            <Search className="h-3 w-3 mr-1" />
            Find
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {results.length > 0 ? `${results.length} matches found` : searching ? "Searching..." : "No search run"}
        </div>
        {results.length > 0 && (
          <ScrollArea className="h-32 rounded-md border">
            <div className="divide-y">
              {results.slice(0, 200).map((off, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(off, query.length || 1)}
                  className="w-full text-left px-2 py-1 hover:bg-accent/40 font-mono text-xs flex justify-between"
                >
                  <span className="text-emerald-600 dark:text-emerald-400">
                    0x{formatOffset(off)}
                  </span>
                  <span className="text-muted-foreground">
                    {bytes.subarray(off, Math.min(off + 16, bytes.length)).length}B
                  </span>
                </button>
              ))}
              {results.length > 200 && (
                <div className="px-2 py-1 text-xs text-muted-foreground italic">
                  ... {results.length - 200} more matches
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <FileText className="h-3 w-3" />
            Extracted Strings
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Min length</Label>
            <Input
              type="number"
              min={2}
              max={32}
              value={minLength}
              onChange={(e) => setMinLength(Math.max(2, Math.min(32, parseInt(e.target.value) || 4)))}
              className="h-7 w-14 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() =>
                copyToClipboard(strings.map((s) => `0x${s.offset.toString(16)}\t${s.text}`).join("\n"))
              }
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>
        <div className="px-3 py-1 text-xs text-muted-foreground border-b">
          {stringsLoading ? "Extracting..." : `${strings.length} strings found`}
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {strings.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground italic">No strings found.</div>
            )}
            {strings.slice(0, 5000).map((s, i) => (
              <button
                key={i}
                onClick={() => jumpTo(s.offset, s.text.length)}
                className="w-full text-left px-3 py-1 hover:bg-accent/40 font-mono text-xs flex gap-2"
              >
                <span className="text-emerald-600 dark:text-emerald-400 shrink-0">
                  0x{formatOffset(s.offset)}
                </span>
                <span className="truncate">{s.text}</span>
              </button>
            ))}
            {strings.length > 5000 && (
              <div className="p-3 text-xs text-muted-foreground italic">
                ... {strings.length - 5000} more strings (refine min length to see all)
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
