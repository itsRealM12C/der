"use client";

import { useMemo, useState } from "react";
import { useHexStore } from "@/lib/hex-store";
import {
  parseHtml,
  formatHtmlOffset,
  attrPreview,
  classifyUrl,
  type HtmlNode,
  type ParsedHtml,
} from "@/lib/html-parser";
import { formatSize } from "@/lib/hex-utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Code2,
  FileText,
  Hash,
  Link as LinkIcon,
  Image as ImageIcon,
  FileCode,
  Palette,
  MessageSquare,
  Tag,
  ExternalLink,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

type SubTab = "overview" | "head" | "body" | "scripts" | "styles" | "resources" | "comments" | "all";

export default function HtmlPanel() {
  const { bytes, fileName, fileSize, setSelection, setCursor, setHighlightRange } = useHexStore();
  const [subtab, setSubtab] = useState<SubTab>("overview");
  const [filterTag, setFilterTag] = useState<string>("");

  const parsed = useMemo<ParsedHtml | null>(() => {
    if (!bytes) return null;
    try {
      return parseHtml(bytes);
    } catch (e) {
      console.error("HTML parse error", e);
      return null;
    }
  }, [bytes]);

  const isHtmlFile = useMemo(() => {
    if (!bytes || !parsed) return false;
    return parsed.nodes.some(
      (n) => n.type === "tag-open" && (n.tagName === "html" || n.tagName === "head" || n.tagName === "body")
    ) || parsed.doctype !== null;
  }, [bytes, parsed]);

  const jumpTo = (offset: number, length: number) => {
    setCursor(offset);
    setSelection(offset, offset + length);
    setHighlightRange({ start: offset, end: offset + length, color: "#3b82f6" });
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success(`${label} copied`);
  };

  if (!bytes) {
    return <div className="text-muted-foreground text-sm p-4">No file loaded.</div>;
  }

  if (!isHtmlFile || !parsed) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        HTML analysis is available for HTML documents. Current file ({fileName || "untitled"}) is
        not recognized as HTML. Open the Structure tab for binary file parsing.
      </div>
    );
  }

  const stats = {
    tags: parsed.nodes.filter((n) => n.type === "tag-open" || n.type === "tag-self-close").length,
    scripts: parsed.scripts.length,
    styles: parsed.styles.length,
    links: parsed.links.length,
    images: parsed.images.length,
    anchors: parsed.anchors.length,
    comments: parsed.comments.length,
    inlineScripts: parsed.inlineScripts.length,
    inlineStyles: parsed.inlineStyles.length,
    external: parsed.externalResources.length,
  };

  const SUBTABS: { value: SubTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { value: "overview", label: "Overview", icon: <FileText className="h-3 w-3" /> },
    { value: "head", label: "Head", icon: <Hash className="h-3 w-3" />, count: parsed.metaTags.length + parsed.scripts.length + parsed.styles.length + parsed.links.length },
    { value: "body", label: "Body", icon: <Tag className="h-3 w-3" />, count: stats.tags },
    { value: "scripts", label: "Scripts", icon: <FileCode className="h-3 w-3" />, count: stats.scripts },
    { value: "styles", label: "Styles", icon: <Palette className="h-3 w-3" />, count: stats.styles },
    { value: "resources", label: "Resources", icon: <LinkIcon className="h-3 w-3" />, count: stats.external },
    { value: "comments", label: "Comments", icon: <MessageSquare className="h-3 w-3" />, count: stats.comments },
    { value: "all", label: "All Nodes", icon: <Code2 className="h-3 w-3" />, count: parsed.nodes.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab strip */}
      <div className="border-b p-2 shrink-0">
        <div className="flex gap-1 overflow-x-auto tab-strip">
          {SUBTABS.map((st) => (
            <button
              key={st.value}
              onClick={() => setSubtab(st.value)}
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                subtab === st.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground"
              }`}
            >
              {st.icon}
              {st.label}
              {st.count !== undefined && st.count > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({st.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3 text-sm">
          {subtab === "overview" && <OverviewTab parsed={parsed} stats={stats} jumpTo={jumpTo} />}
          {subtab === "head" && <HeadTab parsed={parsed} jumpTo={jumpTo} copy={copy} />}
          {subtab === "body" && (
            <BodyTab parsed={parsed} filterTag={filterTag} setFilterTag={setFilterTag} jumpTo={jumpTo} />
          )}
          {subtab === "scripts" && <ScriptsTab parsed={parsed} jumpTo={jumpTo} copy={copy} />}
          {subtab === "styles" && <StylesTab parsed={parsed} jumpTo={jumpTo} copy={copy} />}
          {subtab === "resources" && <ResourcesTab parsed={parsed} jumpTo={jumpTo} copy={copy} />}
          {subtab === "comments" && <CommentsTab parsed={parsed} jumpTo={jumpTo} />}
          {subtab === "all" && <AllNodesTab parsed={parsed} jumpTo={jumpTo} />}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============== Sub-tab components ==============

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-base font-semibold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function NodeRow({
  node,
  jumpTo,
  copy,
  badge,
  attrs,
}: {
  node: HtmlNode;
  jumpTo: (offset: number, length: number) => void;
  copy?: (text: string, label: string) => void;
  badge?: string;
  attrs?: { label: string; value: string }[];
}) {
  const tagLabel = node.tagName || node.type;
  return (
    <div className="rounded-md border p-2 hover:bg-accent/30 group">
      <div className="flex items-center gap-2">
        <button
          onClick={() => jumpTo(node.offset, node.length)}
          className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
        >
          {formatHtmlOffset(node.offset)}
        </button>
        <span className="text-[10px] text-muted-foreground shrink-0">+{node.length}B</span>
        {badge && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
            {badge}
          </span>
        )}
        <span className="font-mono text-xs font-semibold truncate flex-1">
          &lt;{tagLabel}
          {node.type === "tag-close" ? "/" : node.type === "tag-self-close" ? " /" : ""}
          &gt;
        </span>
        {copy && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={() => copy(`<${tagLabel}>`, "tag")}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
      {attrs && attrs.length > 0 && (
        <div className="mt-1 ml-12 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono">
          {attrs.map((a, i) => (
            <span key={i} className="text-muted-foreground">
              <span className="text-amber-600 dark:text-amber-400">{a.label}</span>
              {a.value && <span>=&quot;{a.value}&quot;</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function OverviewTab({
  parsed,
  stats,
  jumpTo,
}: {
  parsed: ParsedHtml;
  stats: Record<string, number>;
  jumpTo: (offset: number, length: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <FileText className="h-3 w-3" />
          Document Overview
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="File size" value={formatSize(parsed.totalLength)} hint={`${parsed.totalLength.toLocaleString()} bytes`} />
          <StatCard label="Total nodes" value={parsed.nodes.length} hint="All HTML tokens" />
          <StatCard label="Tags" value={stats.tags} hint="Opening + self-closing" />
          <StatCard label="Comments" value={stats.comments} hint="&lt;!-- ... --&gt;" />
        </div>
      </div>

      {parsed.doctype && (
        <div>
          <div className="text-xs font-semibold mb-1">DOCTYPE</div>
          <button
            onClick={() => jumpTo(parsed.doctype!.offset, parsed.doctype!.length)}
            className="w-full text-left rounded-md border p-2 hover:bg-accent/30 font-mono text-xs break-all"
          >
            {parsed.doctype.text}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Title" value={parsed.title || "(none)"} />
        <StatCard label="Language" value={parsed.language || "(none)"} />
        <StatCard label="Charset" value={parsed.charset || "(none)"} />
        <StatCard label="Meta tags" value={parsed.metaTags.length} />
      </div>

      <div>
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <Hash className="h-3 w-3" />
          Resource Summary
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Scripts" value={stats.scripts} hint={`${stats.inlineScripts} inline`} />
          <StatCard label="Styles" value={stats.styles} hint={`${stats.inlineStyles} inline`} />
          <StatCard label="Links" value={stats.links} />
          <StatCard label="Images" value={stats.images} />
          <StatCard label="Anchors" value={stats.anchors} />
          <StatCard label="External URLs" value={stats.external} />
        </div>
      </div>

      {parsed.metaTags.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1">Meta Tags</div>
          <div className="space-y-1">
            {parsed.metaTags.slice(0, 8).map((m, i) => {
              const name = m.attributes?.find((a) => a.name === "name" || a.name === "property")?.value;
              const content = m.attributes?.find((a) => a.name === "content")?.value;
              return (
                <button
                  key={i}
                  onClick={() => jumpTo(m.offset, m.length)}
                  className="w-full text-left rounded border px-2 py-1 hover:bg-accent/30 font-mono text-[11px] flex gap-2"
                >
                  <span className="text-amber-600 dark:text-amber-400 shrink-0">{name || m.attributes?.[0]?.name}</span>
                  <span className="truncate">{attrPreview(content || "", 80)}</span>
                </button>
              );
            })}
            {parsed.metaTags.length > 8 && (
              <div className="text-[10px] text-muted-foreground italic px-2">
                +{parsed.metaTags.length - 8} more meta tags — see Head tab
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HeadTab({
  parsed,
  jumpTo,
  copy,
}: {
  parsed: ParsedHtml;
  jumpTo: (offset: number, length: number) => void;
  copy: (text: string, label: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold mb-1">Title</div>
        {parsed.title ? (
          <div className="rounded-md border p-2 font-mono text-xs break-all">{parsed.title}</div>
        ) : (
          <div className="text-xs text-muted-foreground italic">No &lt;title&gt; element found</div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Charset</div>
        <div className="rounded-md border p-2 font-mono text-xs">{parsed.charset || "(not declared)"}</div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Meta Tags ({parsed.metaTags.length})</div>
        <div className="space-y-1">
          {parsed.metaTags.length === 0 && (
            <div className="text-xs text-muted-foreground italic">No &lt;meta&gt; tags</div>
          )}
          {parsed.metaTags.map((m, i) => (
            <NodeRow
              key={i}
              node={m}
              jumpTo={jumpTo}
              copy={copy}
              badge="meta"
              attrs={m.attributes?.map((a) => ({ label: a.name, value: attrPreview(a.value, 50) }))}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1 flex items-center gap-2">
          <LinkIcon className="h-3 w-3" />
          &lt;link&gt; Tags ({parsed.links.length})
        </div>
        <div className="space-y-1">
          {parsed.links.length === 0 && (
            <div className="text-xs text-muted-foreground italic">No &lt;link&gt; tags</div>
          )}
          {parsed.links.map((l, i) => {
            const rel = l.attributes?.find((a) => a.name === "rel")?.value;
            const href = l.attributes?.find((a) => a.name === "href")?.value;
            return (
              <NodeRow
                key={i}
                node={l}
                jumpTo={jumpTo}
                copy={copy}
                badge={rel || "link"}
                attrs={href ? [{ label: "href", value: attrPreview(href, 60) }] : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BodyTab({
  parsed,
  filterTag,
  setFilterTag,
  jumpTo,
}: {
  parsed: ParsedHtml;
  filterTag: string;
  setFilterTag: (s: string) => void;
  jumpTo: (offset: number, length: number) => void;
}) {
  // Get unique tag names for the filter
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of parsed.nodes) {
      if ((n.type === "tag-open" || n.type === "tag-self-close") && n.tagName) {
        m.set(n.tagName, (m.get(n.tagName) || 0) + 1);
      }
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [parsed]);

  const filtered = useMemo(() => {
    return parsed.nodes.filter((n) => {
      if (n.type !== "tag-open" && n.type !== "tag-self-close") return false;
      if (filterTag && n.tagName !== filterTag) return false;
      return true;
    });
  }, [parsed, filterTag]);

  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-semibold mb-1">Filter by tag</div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterTag("")}
            className={`px-2 py-0.5 rounded text-[11px] ${
              !filterTag ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
            }`}
          >
            All ({tagCounts.reduce((s, [, c]) => s + c, 0)})
          </button>
          {tagCounts.slice(0, 20).map(([name, count]) => (
            <button
              key={name}
              onClick={() => setFilterTag(name)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                filterTag === name ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
              }`}
            >
              {name} ({count})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {filtered.slice(0, 500).map((n, i) => (
          <NodeRow
            key={i}
            node={n}
            jumpTo={jumpTo}
            badge={n.type === "tag-self-close" ? "void" : undefined}
            attrs={n.attributes?.slice(0, 4).map((a) => ({
              label: a.name,
              value: attrPreview(a.value, 40),
            }))}
          />
        ))}
        {filtered.length > 500 && (
          <div className="text-[10px] text-muted-foreground italic px-2 py-1">
            Showing first 500 of {filtered.length} nodes. Use the filter to narrow down.
          </div>
        )}
      </div>
    </div>
  );
}

function ScriptsTab({
  parsed,
  jumpTo,
  copy,
}: {
  parsed: ParsedHtml;
  jumpTo: (offset: number, length: number) => void;
  copy: (text: string, label: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold mb-1 flex items-center gap-2">
          <FileCode className="h-3 w-3" />
          External Scripts ({parsed.scripts.filter((s) => s.attributes?.some((a) => a.name === "src")).length})
        </div>
        <div className="space-y-1">
          {parsed.scripts.filter((s) => s.attributes?.some((a) => a.name === "src")).length === 0 && (
            <div className="text-xs text-muted-foreground italic">No external &lt;script src&gt; tags</div>
          )}
          {parsed.scripts
            .filter((s) => s.attributes?.some((a) => a.name === "src"))
            .map((s, i) => {
              const src = s.attributes?.find((a) => a.name === "src")?.value || "";
              const type = s.attributes?.find((a) => a.name === "type")?.value;
              const asyncAttr = s.attributes?.some((a) => a.name === "async");
              const deferAttr = s.attributes?.some((a) => a.name === "defer");
              return (
                <NodeRow
                  key={i}
                  node={s}
                  jumpTo={jumpTo}
                  copy={copy}
                  badge={type || "script"}
                  attrs={[
                    { label: "src", value: attrPreview(src, 70) },
                    ...(asyncAttr ? [{ label: "async", value: "" }] : []),
                    ...(deferAttr ? [{ label: "defer", value: "" }] : []),
                  ]}
                />
              );
            })}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1 flex items-center gap-2">
          <Code2 className="h-3 w-3" />
          Inline Scripts ({parsed.inlineScripts.length})
        </div>
        <div className="space-y-1">
          {parsed.inlineScripts.length === 0 && (
            <div className="text-xs text-muted-foreground italic">No inline &lt;script&gt; bodies</div>
          )}
          {parsed.inlineScripts.map((s, i) => (
            <div key={i} className="rounded-md border p-2 hover:bg-accent/30 group">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => jumpTo(s.bodyOffset, s.bodyLength)}
                  className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                >
                  {formatHtmlOffset(s.bodyOffset)}
                </button>
                <span className="text-[10px] text-muted-foreground shrink-0">+{s.bodyLength}B</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                  inline
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {s.body.split("\n").length} lines
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={() => copy(s.body, "inline script")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="mt-1 ml-12 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                {s.body.substring(0, 400)}
                {s.body.length > 400 && "\n…"}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StylesTab({
  parsed,
  jumpTo,
  copy,
}: {
  parsed: ParsedHtml;
  jumpTo: (offset: number, length: number) => void;
  copy: (text: string, label: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold mb-1 flex items-center gap-2">
          <LinkIcon className="h-3 w-3" />
          External Stylesheets ({parsed.links.filter((l) => l.attributes?.some((a) => a.name === "rel" && a.value.includes("stylesheet"))).length})
        </div>
        <div className="space-y-1">
          {parsed.links.filter((l) => l.attributes?.some((a) => a.name === "rel" && a.value.includes("stylesheet"))).length === 0 && (
            <div className="text-xs text-muted-foreground italic">No external &lt;link rel=stylesheet&gt; tags</div>
          )}
          {parsed.links
            .filter((l) => l.attributes?.some((a) => a.name === "rel" && a.value.includes("stylesheet")))
            .map((l, i) => {
              const href = l.attributes?.find((a) => a.name === "href")?.value || "";
              return (
                <NodeRow
                  key={i}
                  node={l}
                  jumpTo={jumpTo}
                  copy={copy}
                  badge="stylesheet"
                  attrs={[{ label: "href", value: attrPreview(href, 70) }]}
                />
              );
            })}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1 flex items-center gap-2">
          <Palette className="h-3 w-3" />
          Inline &lt;style&gt; Blocks ({parsed.inlineStyles.length})
        </div>
        <div className="space-y-1">
          {parsed.inlineStyles.length === 0 && (
            <div className="text-xs text-muted-foreground italic">No inline &lt;style&gt; blocks</div>
          )}
          {parsed.inlineStyles.map((s, i) => (
            <div key={i} className="rounded-md border p-2 hover:bg-accent/30 group">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => jumpTo(s.bodyOffset, s.bodyLength)}
                  className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                >
                  {formatHtmlOffset(s.bodyOffset)}
                </button>
                <span className="text-[10px] text-muted-foreground shrink-0">+{s.bodyLength}B</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
                  inline CSS
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={() => copy(s.body, "inline CSS")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="mt-1 ml-12 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                {s.body.substring(0, 400)}
                {s.body.length > 400 && "\n…"}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourcesTab({
  parsed,
  jumpTo,
  copy,
}: {
  parsed: ParsedHtml;
  jumpTo: (offset: number, length: number) => void;
  copy: (text: string, label: string) => void;
}) {
  const grouped = useMemo(() => {
    const m = new Map<string, typeof parsed.externalResources>();
    for (const r of parsed.externalResources) {
      const k = r.kind;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [parsed]);

  const KIND_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    script: { label: "Scripts", icon: <FileCode className="h-3 w-3" />, color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
    style: { label: "Stylesheets / Icons", icon: <Palette className="h-3 w-3" />, color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
    image: { label: "Images", icon: <ImageIcon className="h-3 w-3" />, color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    anchor: { label: "Anchors (Links)", icon: <LinkIcon className="h-3 w-3" />, color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  };

  return (
    <div className="space-y-3">
      {(["script", "style", "image", "anchor"] as const).map((kind) => {
        const items = grouped.get(kind) || [];
        const meta = KIND_LABELS[kind];
        return (
          <div key={kind}>
            <div className="text-xs font-semibold mb-1 flex items-center gap-2">
              {meta.icon}
              {meta.label} ({items.length})
            </div>
            <div className="space-y-1">
              {items.length === 0 && (
                <div className="text-xs text-muted-foreground italic">No {meta.label.toLowerCase()}</div>
              )}
              {items.map((r, i) => {
                const cls = classifyUrl(r.url);
                const clsColor =
                  cls === "external"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : cls === "data"
                    ? "text-purple-600 dark:text-purple-400"
                    : cls === "anchor"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground";
                return (
                  <div key={i} className="rounded-md border p-2 hover:bg-accent/30 group flex items-center gap-2">
                    <button
                      onClick={() => jumpTo(r.node.offset, r.node.length)}
                      className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      {formatHtmlOffset(r.node.offset)}
                    </button>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${meta.color} shrink-0`}>{kind}</span>
                    <span className={`text-[10px] shrink-0 ${clsColor}`}>{cls}</span>
                    <span className="font-mono text-xs truncate flex-1" title={r.url}>
                      {attrPreview(r.url, 80)}
                    </span>
                    {cls === "external" && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={() => copy(r.url, "URL")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommentsTab({
  parsed,
  jumpTo,
}: {
  parsed: ParsedHtml;
  jumpTo: (offset: number, length: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold mb-2 flex items-center gap-2">
        <MessageSquare className="h-3 w-3" />
        HTML Comments ({parsed.comments.length})
      </div>
      {parsed.comments.length === 0 && (
        <div className="text-xs text-muted-foreground italic">No &lt;!-- ... --&gt; comments</div>
      )}
      {parsed.comments.slice(0, 200).map((c, i) => (
        <button
          key={i}
          onClick={() => jumpTo(c.offset, c.length)}
          className="w-full text-left rounded-md border p-2 hover:bg-accent/30 group"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
              {formatHtmlOffset(c.offset)}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">+{c.length}B</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground shrink-0">
              comment
            </span>
          </div>
          <pre className="mt-1 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-16 overflow-y-auto">
            {(c.text || "").trim().substring(0, 300)}
            {(c.text || "").length > 300 && "\n…"}
          </pre>
        </button>
      ))}
      {parsed.comments.length > 200 && (
        <div className="text-[10px] text-muted-foreground italic px-2 py-1">
          Showing first 200 of {parsed.comments.length} comments.
        </div>
      )}
    </div>
  );
}

function AllNodesTab({
  parsed,
  jumpTo,
}: {
  parsed: ParsedHtml;
  jumpTo: (offset: number, length: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold mb-2 flex items-center gap-2">
        <Code2 className="h-3 w-3" />
        All Nodes ({parsed.nodes.length})
      </div>
      <div className="font-mono text-[11px]">
        {parsed.nodes.slice(0, 1000).map((n, i) => {
          const typeColor =
            n.type === "tag-open" || n.type === "tag-self-close"
              ? "text-emerald-600 dark:text-emerald-400"
              : n.type === "tag-close"
              ? "text-amber-600 dark:text-amber-400"
              : n.type === "comment"
              ? "text-muted-foreground italic"
              : n.type === "doctype"
              ? "text-purple-600 dark:text-purple-400"
              : "text-muted-foreground";
          return (
            <button
              key={i}
              onClick={() => jumpTo(n.offset, n.length)}
              className="w-full text-left rounded px-2 py-0.5 hover:bg-accent/30 flex gap-2 items-baseline"
            >
              <span className="text-[10px] text-muted-foreground/70 shrink-0">
                {formatHtmlOffset(n.offset)}
              </span>
              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                +{n.length.toString().padStart(4, " ")}
              </span>
              <span className={`${typeColor} shrink-0`}>
                {n.type === "tag-open" ? "<" : n.type === "tag-close" ? "</" : n.type === "tag-self-close" ? "<" : n.type === "text" ? "txt" : n.type === "comment" ? "/*" : n.type === "cdata" ? "<![" : "<!"}
                {n.tagName || ""}
                {n.type === "tag-self-close" ? " />" : n.type === "tag-open" ? ">" : n.type === "tag-close" ? ">" : ""}
              </span>
              {n.attributes && n.attributes.length > 0 && (
                <span className="text-[10px] text-muted-foreground truncate">
                  {n.attributes.slice(0, 3).map((a) => ` ${a.name}${a.value ? `="${attrPreview(a.value, 20)}"` : ""}`).join("")}
                  {n.attributes.length > 3 && ` +${n.attributes.length - 3}`}
                </span>
              )}
              {n.text && n.type === "text" && (
                <span className="text-[10px] text-muted-foreground/70 truncate">
                  {attrPreview(n.text.trim(), 50)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {parsed.nodes.length > 1000 && (
        <div className="text-[10px] text-muted-foreground italic px-2 py-1">
          Showing first 1000 of {parsed.nodes.length} nodes.
        </div>
      )}
    </div>
  );
}
