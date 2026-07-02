"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHexStore } from "@/lib/hex-store";
import {
  bytesToAscii,
  bytesToText,
  formatByte,
  formatOffset,
} from "@/lib/hex-utils";

interface HexViewProps {
  /** Notified when the user changes cursor / selection. */
  onSelectionChange?: (start: number, end: number) => void;
  /** Optional parsed-field overlay (offsets to highlight + colors). */
  fieldHighlights?: { offset: number; size: number; color: string; name: string }[];
}

const ROW_HEIGHT = 22;
const VIRTUAL_OVERSCAN = 8;

export default function HexView({ onSelectionChange, fieldHighlights }: HexViewProps) {
  const {
    bytes,
    bytesPerRow,
    bytesPerGroup,
    encoding,
    showAscii,
    showOffset,
    readOnly,
    selectionStart,
    selectionEnd,
    cursor,
    highlightRange,
    setSelection,
    setCursor,
    writeByte,
  } = useHexStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [editingOffset, setEditingOffset] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setViewportHeight(e.contentRect.height);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const totalRows = bytes ? Math.ceil(bytes.length / bytesPerRow) : 0;
  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIRTUAL_OVERSCAN);
  const visibleRowCount = Math.ceil(viewportHeight / ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
  const lastVisibleRow = Math.min(totalRows, firstVisibleRow + visibleRowCount);

  // Build a quick lookup of which byte is highlighted by which color (from fields).
  const byteColorMap = useMemo(() => {
    const m = new Map<number, { color: string; name: string }>();
    if (fieldHighlights) {
      for (const f of fieldHighlights) {
        for (let i = 0; i < f.size; i++) {
          if (!m.has(f.offset + i)) {
            m.set(f.offset + i, { color: f.color, name: f.name });
          }
        }
      }
    }
    return m;
  }, [fieldHighlights]);

  // Selection helpers
  const isSelected = useCallback(
    (i: number) => {
      if (selectionStart === selectionEnd) return i === cursor;
      return i >= selectionStart && i < selectionEnd;
    },
    [selectionStart, selectionEnd, cursor]
  );

  const inHighlightRange = useCallback(
    (i: number) => {
      if (!highlightRange) return false;
      return i >= highlightRange.start && i < highlightRange.end;
    },
    [highlightRange]
  );

  const handleByteClick = (i: number, shiftKey: boolean) => {
    if (shiftKey && dragStart !== null) {
      const start = Math.min(dragStart, i);
      const end = Math.max(dragStart, i) + 1;
      setSelection(start, end);
      setCursor(i);
      onSelectionChange?.(start, end);
    } else {
      setCursor(i);
      setSelection(i, i + 1);
      setDragStart(i);
      onSelectionChange?.(i, i + 1);
    }
  };

  const handleByteMouseDown = (i: number) => {
    if (readOnly) {
      setDragStart(i);
      setIsDragging(true);
      setCursor(i);
      setSelection(i, i + 1);
      onSelectionChange?.(i, i + 1);
    } else {
      setEditingOffset(i);
      setEditValue("");
      setCursor(i);
      setSelection(i, i + 1);
      // focus the container so keyboard input works
      requestAnimationFrame(() => containerRef.current?.focus());
    }
  };

  const handleByteMouseEnter = (i: number) => {
    if (isDragging && dragStart !== null) {
      const start = Math.min(dragStart, i);
      const end = Math.max(dragStart, i) + 1;
      setSelection(start, end);
      onSelectionChange?.(start, end);
    }
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  // Handle edit input
  const handleEditKey = (e: React.KeyboardEvent) => {
    if (editingOffset === null) return;
    if (/^[0-9a-fA-F]$/.test(e.key)) {
      e.preventDefault();
      const next = editValue + e.key;
      setEditValue(next);
      if (next.length === 2) {
        const byte = parseInt(next, 16);
        writeByte(editingOffset, byte);
        setEditingOffset(editingOffset + 1);
        setEditValue("");
      }
    } else if (e.key === "Escape") {
      setEditingOffset(null);
      setEditValue("");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setEditingOffset((o) => (o !== null ? Math.min((bytes?.length ?? 1) - 1, o + 1) : o));
      setEditValue("");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setEditingOffset((o) => (o !== null ? Math.max(0, o - 1) : o));
      setEditValue("");
    } else if (e.key === "Backspace") {
      e.preventDefault();
      if (editValue.length === 0) {
        setEditingOffset((o) => (o !== null ? Math.max(0, o - 1) : o));
        setEditValue("");
      } else {
        setEditValue("");
      }
    }
  };

  // Render rows (React Compiler auto-memoizes)
  const rows: React.ReactNode[] = (() => {
    if (!bytes) return [];
    const out: React.ReactNode[] = [];
    for (let r = firstVisibleRow; r < lastVisibleRow; r++) {
      const rowStart = r * bytesPerRow;
      const rowEnd = Math.min(rowStart + bytesPerRow, bytes.length);
      const rowBytes = bytes.subarray(rowStart, rowEnd);
      const hexCells: React.ReactNode[] = [];
      const asciiCells: React.ReactNode[] = [];
      for (let i = 0; i < bytesPerRow; i++) {
        const absIdx = rowStart + i;
        const inRange = absIdx < rowEnd;
        const b = inRange ? rowBytes[i] : undefined;
        const selected = inRange && isSelected(absIdx);
        const highlighted = inRange && inHighlightRange(absIdx);
        const fieldInfo = inRange ? byteColorMap.get(absIdx) : undefined;
        const isEditing = absIdx === editingOffset;

        // Background color priority: selected > editing > field color > highlight > none
        let bg = "transparent";
        if (selected) bg = "rgba(245, 158, 11, 0.5)";
        else if (isEditing) bg = "rgba(245, 158, 11, 0.7)";
        else if (highlighted) bg = "rgba(59, 130, 246, 0.25)";
        else if (fieldInfo) bg = `${fieldInfo.color}22`;

        const hexContent = isEditing
          ? editValue.length === 0
            ? "__"
            : editValue.padEnd(2, "_")
          : b !== undefined
          ? formatByte(b)
          : "  ";

        hexCells.push(
          <span
            key={`h-${absIdx}`}
            className="inline-flex items-center cursor-pointer select-none"
            style={{
              minWidth: "1.65em",
              padding: "0 1px",
              backgroundColor: bg,
              borderRadius: "2px",
              color: isEditing ? "#000" : undefined,
              fontWeight: fieldInfo ? 700 : 400,
            }}
            onMouseDown={() => inRange && handleByteMouseDown(absIdx)}
            onMouseEnter={() => inRange && handleByteMouseEnter(absIdx)}
            onClick={(e) => inRange && handleByteClick(absIdx, e.shiftKey)}
            title={fieldInfo ? fieldInfo.name : undefined}
          >
            {hexContent}
          </span>
        );
        if ((i + 1) % bytesPerGroup === 0 && i < bytesPerRow - 1) {
          hexCells.push(
            <span key={`g-${absIdx}`} style={{ display: "inline-block", width: "0.6em" }} />
          );
        }

        if (showAscii && inRange && b !== undefined) {
          const asciiChar =
            encoding === "ascii" || encoding === "latin1"
              ? bytesToAscii(new Uint8Array([b]))
              : b >= 32 && b !== 127
              ? String.fromCharCode(b)
              : ".";
          asciiCells.push(
            <span
              key={`a-${absIdx}`}
              className="inline-flex items-center cursor-pointer select-none"
              style={{
                padding: "0 0.5px",
                backgroundColor: bg,
                borderRadius: "2px",
                fontWeight: fieldInfo ? 700 : 400,
              }}
              onMouseDown={() => handleByteMouseDown(absIdx)}
              onMouseEnter={() => handleByteMouseEnter(absIdx)}
              onClick={(e) => handleByteClick(absIdx, e.shiftKey)}
              title={fieldInfo ? fieldInfo.name : undefined}
            >
              {asciiChar}
            </span>
          );
        } else if (showAscii) {
          asciiCells.push(
            <span key={`a-${absIdx}`} style={{ padding: "0 0.5px" }}>
              {" "}
            </span>
          );
        }
      }

      const rowTextDecoded = showAscii
        ? encoding === "ascii" || encoding === "latin1"
          ? bytesToAscii(rowBytes)
          : bytesToText(rowBytes, encoding)
        : "";

      out.push(
        <div
          key={`r-${r}`}
          style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}
          className="flex items-center font-mono text-xs"
        >
          {showOffset && (
            <span
              className="text-muted-foreground pr-4 select-none"
              style={{ minWidth: "10em" }}
            >
              {formatOffset(rowStart)}
            </span>
          )}
          <div
            className="flex-1 flex flex-wrap items-center"
            onKeyDown={handleEditKey}
            tabIndex={0}
          >
            {hexCells}
          </div>
          {showAscii && (
            <div
              className="ml-4 select-none"
              style={{
                minWidth: `${bytesPerRow + 2}ch`,
                whiteSpace: "pre",
              }}
            >
              {rowTextDecoded}
            </div>
          )}
        </div>
      );
    }
    return out;
  })();

  if (!bytes) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No file loaded. Drag &amp; drop or use Open File in the toolbar.
      </div>
    );
  }

  const totalHeight = totalRows * ROW_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto relative bg-background outline-none"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
      tabIndex={0}
      onKeyDown={(e) => {
        // If editing, route hex input to the editor
        if (editingOffset !== null && !readOnly) {
          if (/^[0-9a-fA-F]$/.test(e.key)) {
            e.preventDefault();
            const next = editValue + e.key;
            setEditValue(next);
            if (next.length === 2) {
              const byte = parseInt(next, 16);
              writeByte(editingOffset, byte);
              setEditingOffset(editingOffset + 1);
              setEditValue("");
            }
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditingOffset(null);
            setEditValue("");
            return;
          }
          if (e.key === "Backspace") {
            e.preventDefault();
            if (editValue.length === 0) {
              const prev = Math.max(0, editingOffset - 1);
              setEditingOffset(prev);
              setEditValue("");
            } else {
              setEditValue("");
            }
            return;
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setEditingOffset((o) => (o !== null ? Math.min(bytes.length - 1, o + 1) : o));
            setEditValue("");
            return;
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setEditingOffset((o) => (o !== null ? Math.max(0, o - 1) : o));
            setEditValue("");
            return;
          }
        }
        // Navigation keys (work in both modes)
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const next = Math.min(bytes.length - 1, cursor + bytesPerRow);
          setCursor(next);
          setSelection(next, next + 1);
          if (editingOffset !== null) setEditingOffset(next);
          onSelectionChange?.(next, next + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const next = Math.max(0, cursor - bytesPerRow);
          setCursor(next);
          setSelection(next, next + 1);
          if (editingOffset !== null) setEditingOffset(next);
          onSelectionChange?.(next, next + 1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          const next = Math.min(bytes.length - 1, cursor + 1);
          setCursor(next);
          setSelection(next, next + 1);
          if (editingOffset !== null) setEditingOffset(next);
          onSelectionChange?.(next, next + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          const next = Math.max(0, cursor - 1);
          setCursor(next);
          setSelection(next, next + 1);
          if (editingOffset !== null) setEditingOffset(next);
          onSelectionChange?.(next, next + 1);
        } else if (e.key === "Tab") {
          // ensure focus stays in container
          e.preventDefault();
        }
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: firstVisibleRow * ROW_HEIGHT,
            left: 0,
            right: 0,
          }}
        >
          {rows}
        </div>
      </div>
    </div>
  );
}
