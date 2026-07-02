/**
 * Pure-TS HTML tokenizer / lightweight parser.
 *
 * Goal: produce a list of structural elements with their byte offsets into
 * the source, so the HexForge hex view can highlight and jump to them.
 *
 * This is NOT a full DOM. It's a "good enough" parser for reverse-engineering
 * inspection of HTML files (e.g. GitHub Pages sites, single-page apps, etc.).
 *
 * It handles:
 *  - DOCTYPE declarations
 *  - Comments <!-- ... -->
 *  - CDATA sections <![CDATA[ ... ]]>
 *  - Opening / closing / self-closing tags with attributes
 *  - Text nodes (raw bytes between tags)
 *  - <script> and <style> raw-text content (parsed as a single text node)
 *
 * It does NOT build a tree — the panel can reconstruct nesting from the
 * flat list if needed. For the inspector use-case, a flat list with byte
 * offsets is more useful (you can click any element and jump to its bytes).
 */

export type HtmlNodeType =
  | "doctype"
  | "comment"
  | "cdata"
  | "text"
  | "tag-open"
  | "tag-close"
  | "tag-self-close";

export interface HtmlAttribute {
  name: string;
  value: string;
  /** Byte offset of the attribute's value (or name if value-less). */
  offset: number;
  /** Byte length of the attribute's serialized form. */
  length: number;
}

export interface HtmlNode {
  type: HtmlNodeType;
  /** Byte offset of the start of the node in the source. */
  offset: number;
  /** Byte length of the node. */
  length: number;
  /** Tag name (lowercase) for tag-open / tag-close / tag-self-close. */
  tagName?: string;
  /** Attributes (tag-open / tag-self-close only). */
  attributes?: HtmlAttribute[];
  /** Text content (text/comment/cdata/script-body/style-body only). */
  text?: string;
  /** True if this tag is a known void element (br, img, input, ...). */
  isVoid?: boolean;
  /** True if this is a raw-text element (script/style/textarea/title). */
  isRawText?: boolean;
}

export interface ParsedHtml {
  nodes: HtmlNode[];
  /** Quick-access collections for the inspector panel. */
  doctype: HtmlNode | null;
  title: string | null;
  language: string | null;
  charset: string | null;
  metaTags: HtmlNode[];
  scripts: HtmlNode[];
  styles: HtmlNode[];
  links: HtmlNode[];
  images: HtmlNode[];
  anchors: HtmlNode[];
  comments: HtmlNode[];
  /** Inline <script> bodies (with offsets). */
  inlineScripts: { node: HtmlNode; body: string; bodyOffset: number; bodyLength: number }[];
  /** Inline <style> bodies (with offsets). */
  inlineStyles: { node: HtmlNode; body: string; bodyOffset: number; bodyLength: number }[];
  /** External resource URLs collected from <script src>, <link href>, <img src>, <a href>. */
  externalResources: { kind: "script" | "style" | "image" | "anchor"; url: string; node: HtmlNode }[];
  /** Total byte length parsed. */
  totalLength: number;
}

// Void elements — never have closing tags.
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

// Raw-text elements — content is not parsed as HTML.
const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);

/**
 * Parse an HTML byte buffer (UTF-8) into a flat list of structural nodes
 * with byte offsets.
 */
export function parseHtml(bytes: Uint8Array): ParsedHtml {
  // Decode as UTF-8 (HTML is text). Use TextDecoder with fatal=false so
  // invalid bytes become replacement chars instead of throwing.
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const text = decoder.decode(bytes);
  const nodes: HtmlNode[] = [];

  let i = 0;
  const n = text.length;

  // --- Helpers ---

  /** Match a literal string at position i (case-sensitive for ASCII). */
  const matchLit = (s: string) => {
    if (i + s.length > n) return false;
    for (let k = 0; k < s.length; k++) {
      if (text.charCodeAt(i + k) !== s.charCodeAt(k)) return false;
    }
    return true;
  };

  const matchLitCI = (s: string) => {
    if (i + s.length > n) return false;
    for (let k = 0; k < s.length; k++) {
      const a = text.charCodeAt(i + k);
      const b = s.charCodeAt(k);
      if (a !== b && a !== b + 32 && a !== b - 32) return false;
    }
    return true;
  };

  const skipWhitespace = () => {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else break;
    }
  };

  /** Parse a quoted or unquoted attribute value starting at i. Returns [value, newI]. */
  const parseAttrValue = (): [string, number] => {
    if (i >= n) return ["", i];
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i + 1;
      let end = text.indexOf(quote, start);
      if (end === -1) end = n;
      return [text.substring(start, end), end + 1];
    }
    // Unquoted value — runs until whitespace or '>'
    const start = i;
    while (i < n) {
      const c = text[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === ">" || c === "/") break;
      i++;
    }
    return [text.substring(start, i), i];
  };

  /** Parse attributes inside a tag, starting just after the tag name. */
  const parseAttributes = (startI: number): HtmlAttribute[] => {
    const attrs: HtmlAttribute[] = [];
    while (i < n) {
      skipWhitespace();
      if (i >= n) break;
      const c = text[i];
      if (c === ">" || c === "/") break;
      // Attribute name
      const nameStart = i;
      while (i < n) {
        const ch = text[i];
        if (ch === "=" || ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === ">" || ch === "/" || ch === "<") break;
        i++;
      }
      const name = text.substring(nameStart, i).toLowerCase();
      if (!name) {
        // Stuck — advance to avoid infinite loop
        i++;
        continue;
      }
      skipWhitespace();
      let value = "";
      let valueOffset = nameStart;
      let valueLength = i - nameStart;
      if (text[i] === "=") {
        i++; // skip =
        skipWhitespace();
        valueOffset = i;
        const [v, newI] = parseAttrValue();
        value = v;
        valueLength = i - valueOffset;
        void newI;
      }
      attrs.push({ name, value, offset: valueOffset, length: valueLength });
    }
    return attrs;
  };

  /** Parse a tag starting at '<' (i points to '<'). Returns the node and advances i past '>'. */
  const parseTag = () => {
    const start = i;
    i++; // skip '<'
    if (text[i] === "/") {
      // Closing tag
      i++;
      const nameStart = i;
      while (i < n && text[i] !== ">" && text[i] !== "<") i++;
      const tagName = text.substring(nameStart, i).trim().toLowerCase();
      // Skip to '>'
      while (i < n && text[i] !== ">") i++;
      if (i < n) i++; // skip '>'
      nodes.push({
        type: "tag-close",
        offset: start,
        length: i - start,
        tagName,
      });
      return;
    }
    if (text[i] === "!") {
      // DOCTYPE, comment, or CDATA
      if (matchLitCI("<!--")) {
        // Comment
        const commentStart = i;
        const end = text.indexOf("-->", i + 4);
        const realEnd = end === -1 ? n : end + 3;
        const body = text.substring(i + 4, end === -1 ? n : end);
        i = realEnd;
        nodes.push({
          type: "comment",
          offset: commentStart,
          length: realEnd - commentStart,
          text: body,
        });
        return;
      }
      if (matchLitCI("<![CDATA[")) {
        const cdataStart = i;
        const end = text.indexOf("]]>", i + 9);
        const realEnd = end === -1 ? n : end + 3;
        const body = text.substring(i + 9, end === -1 ? n : end);
        i = realEnd;
        nodes.push({
          type: "cdata",
          offset: cdataStart,
          length: realEnd - cdataStart,
          text: body,
        });
        return;
      }
      // DOCTYPE or other <!...> declaration
      const declStart = i;
      while (i < n && text[i] !== ">") i++;
      if (i < n) i++;
      const body = text.substring(declStart, i);
      const isDoctype = /^<!doctype/i.test(body);
      nodes.push({
        type: "doctype",
        offset: declStart,
        length: i - declStart,
        text: body,
        attributes: isDoctype ? [{ name: "doctype", value: body, offset: declStart, length: i - declStart }] : undefined,
      });
      return;
    }
    // Opening tag
    const nameStart = i;
    while (i < n) {
      const ch = text[i];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === ">" || ch === "/" || ch === "<") break;
      i++;
    }
    const tagName = text.substring(nameStart, i).toLowerCase();
    const attrs = parseAttributes(i);
    // Check for self-closing
    let selfClosing = false;
    if (text[i] === "/") {
      selfClosing = true;
      i++;
    }
    // Skip '>'
    if (text[i] === ">") i++;
    const isVoid = VOID_ELEMENTS.has(tagName);
    const isRawText = RAW_TEXT_ELEMENTS.has(tagName);
    const node: HtmlNode = {
      type: selfClosing || isVoid ? "tag-self-close" : "tag-open",
      offset: start,
      length: i - start,
      tagName,
      attributes: attrs,
      isVoid,
      isRawText,
    };
    nodes.push(node);

    // For raw-text elements (script/style/textarea/title), consume the body
    // as raw text until the matching closing tag.
    if (isRawText && !selfClosing && !isVoid) {
      const closeTag = `</${tagName}`;
      const bodyStart = i;
      let end = -1;
      // Case-insensitive search for </tagName
      const lower = text.toLowerCase();
      let searchFrom = i;
      while (searchFrom < n) {
        const idx = lower.indexOf(closeTag, searchFrom);
        if (idx === -1) {
          end = n;
          break;
        }
        // Verify the char after closeTag is whitespace, '>', or '/'
        const after = text[idx + closeTag.length];
        if (after === undefined || after === ">" || after === "/" || after === " " || after === "\t" || after === "\n" || after === "\r") {
          end = idx;
          break;
        }
        searchFrom = idx + 1;
      }
      if (end === -1) end = n;
      const body = text.substring(bodyStart, end);
      nodes.push({
        type: "text",
        offset: bodyStart,
        length: end - bodyStart,
        text: body,
      });
      // Skip the closing tag
      i = end;
      if (i < n && text[i] === "<") {
        const closeStart = i;
        i++; // <
        if (text[i] === "/") i++;
        while (i < n && text[i] !== ">" && text[i] !== "<") i++;
        if (text[i] === ">") i++;
        nodes.push({
          type: "tag-close",
          offset: closeStart,
          length: i - closeStart,
          tagName,
        });
      }
    }
  };

  // --- Main loop ---
  while (i < n) {
    if (text[i] === "<") {
      // Could be a tag, comment, doctype, or just a stray '<'
      const next = text[i + 1];
      if (next === undefined) {
        // End of input
        i++;
        break;
      }
      if (next === "!" || next === "/" || next === "?" || /[a-zA-Z]/.test(next)) {
        parseTag();
        continue;
      }
      // Stray '<' — treat as text
    }
    // Text node — consume until next '<'
    const textStart = i;
    while (i < n && text[i] !== "<") i++;
    if (i > textStart) {
      nodes.push({
        type: "text",
        offset: textStart,
        length: i - textStart,
        text: text.substring(textStart, i),
      });
    } else if (i < n && text[i] === "<") {
      // Already handled above; if we get here it was a stray '<'
      i++;
    }
  }

  return collectInsights(nodes, text, bytes.length);
}

/**
 * Walk the flat node list and pull out the inspector-relevant collections.
 */
function collectInsights(nodes: HtmlNode[], text: string, totalLength: number): ParsedHtml {
  const result: ParsedHtml = {
    nodes,
    doctype: null,
    title: null,
    language: null,
    charset: null,
    metaTags: [],
    scripts: [],
    styles: [],
    links: [],
    images: [],
    anchors: [],
    comments: [],
    inlineScripts: [],
    inlineStyles: [],
    externalResources: [],
    totalLength,
  };

  // Find doctype
  for (const node of nodes) {
    if (node.type === "doctype") {
      result.doctype = node;
      break;
    }
  }

  // Walk tag-open nodes to extract meta info and resource collections.
  let titleOpenIdx = -1;
  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx];
    if (node.type !== "tag-open" && node.type !== "tag-self-close") continue;
    const tag = node.tagName || "";
    const attrs = node.attributes || [];
    const getAttr = (name: string) => attrs.find((a) => a.name === name)?.value || "";

    switch (tag) {
      case "html": {
        const lang = getAttr("lang");
        if (lang && !result.language) result.language = lang;
        break;
      }
      case "meta": {
        result.metaTags.push(node);
        const charset = getAttr("charset");
        if (charset && !result.charset) result.charset = charset;
        break;
      }
      case "title": {
        if (titleOpenIdx === -1) titleOpenIdx = idx;
        break;
      }
      case "script": {
        result.scripts.push(node);
        const src = getAttr("src");
        if (src) {
          result.externalResources.push({ kind: "script", url: src, node });
        } else {
          // Inline script — find the next text node which is the body
          const bodyNode = nodes[idx + 1];
          if (bodyNode && bodyNode.type === "text") {
            result.inlineScripts.push({
              node,
              body: bodyNode.text || "",
              bodyOffset: bodyNode.offset,
              bodyLength: bodyNode.length,
            });
          }
        }
        break;
      }
      case "style": {
        result.styles.push(node);
        const bodyNode = nodes[idx + 1];
        if (bodyNode && bodyNode.type === "text") {
          result.inlineStyles.push({
            node,
            body: bodyNode.text || "",
            bodyOffset: bodyNode.offset,
            bodyLength: bodyNode.length,
          });
        }
        break;
      }
      case "link": {
        result.links.push(node);
        const rel = getAttr("rel").toLowerCase();
        const href = getAttr("href");
        if (href && (rel.includes("stylesheet") || rel.includes("icon") || rel.includes("canonical") || rel.includes("preload"))) {
          result.externalResources.push({ kind: "style", url: href, node });
        }
        break;
      }
      case "img": {
        result.images.push(node);
        const src = getAttr("src");
        if (src) result.externalResources.push({ kind: "image", url: src, node });
        break;
      }
      case "a": {
        result.anchors.push(node);
        const href = getAttr("href");
        if (href) result.externalResources.push({ kind: "anchor", url: href, node });
        break;
      }
    }
  }

  // Extract title text
  if (titleOpenIdx >= 0) {
    const titleBody = nodes[titleOpenIdx + 1];
    if (titleBody && titleBody.type === "text") {
      result.title = (titleBody.text || "").trim();
    }
  }

  // Collect comments
  for (const node of nodes) {
    if (node.type === "comment") result.comments.push(node);
  }

  return result;
}

/** Detect whether a byte buffer looks like HTML. */
export function isHtml(bytes: Uint8Array): boolean {
  // Look at the first 1KB for an HTML signature.
  const head = bytes.subarray(0, Math.min(1024, bytes.length));
  const text = new TextDecoder("utf-8", { fatal: false }).decode(head).toLowerCase();
  // Skip leading BOM or whitespace
  const trimmed = text.replace(/^[\ufeff\s]*/, "");
  if (trimmed.startsWith("<!doctype html")) return true;
  if (trimmed.startsWith("<html")) return true;
  if (trimmed.startsWith("<head")) return true;
  // Loose match: starts with any HTML-ish tag
  if (/^<[a-z][a-z0-9-]*[\s/>]/.test(trimmed)) {
    // Make sure it's not just an XML prolog or SVG
    if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<svg")) return true;
  }
  return false;
}

/** Format a byte offset as hex for display. */
export function formatHtmlOffset(offset: number): string {
  return "0x" + offset.toString(16).toUpperCase().padStart(4, "0");
}

/** Get a short preview of an attribute value (truncated). */
export function attrPreview(value: string, maxLen = 60): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.substring(0, maxLen - 1) + "…";
}

/** Classify an external URL as local / same-origin / external / data / anchor. */
export function classifyUrl(url: string): "data" | "anchor" | "mailto" | "tel" | "external" | "relative" | "absolute" {
  if (url.startsWith("#")) return "anchor";
  if (url.startsWith("data:")) return "data";
  if (url.startsWith("mailto:")) return "mailto";
  if (url.startsWith("tel:")) return "tel";
  if (url.startsWith("//") || /^https?:\/\//i.test(url)) return "external";
  if (url.startsWith("/")) return "absolute";
  return "relative";
}
