import { createNodeId, createStableTestId } from "./ids";
import type { DocumentState, GroupFrame, MindNode, ParseResult } from "./types";

interface HeadingToken {
  level: number;
  title: string;
  body: string[];
}

export const MULTIPLE_H1_NORMALIZED_WARNING = "Markdown has multiple H1 headings; wrapped them under 根主题.";

const SIDE_MARKER_PATTERN = /^<!--\s*openmind:side=(left|right)\s*-->\s*$/;
const SIZE_MARKER_PATTERN = /^<!--\s*openmind:size=(\d+)x(\d+)\s*-->\s*$/;
const FRAMES_MARKER_PATTERN = /^<!--\s*openmind:frames=([A-Za-z0-9+/=]+)\s*-->\s*$/;

interface SerializedGroupFrame {
  n: number[];
  note: string;
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "OpenMind";
}

function decodeHeadingTitle(title: string): string {
  return title.replace(/<br\s*\/?>/gi, "\n");
}

function encodeHeadingTitle(title: string): string {
  return (title.trim() || "Untitled").replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
}

function normalizeNote(lines: string[]): string {
  return lines.join("\n").trim();
}

function headingToNode(token: HeadingToken, index: number): MindNode {
  const sideMarkerIndex = token.body.findIndex((line) => SIDE_MARKER_PATTERN.test(line.trim()));
  const side = sideMarkerIndex >= 0
    ? SIDE_MARKER_PATTERN.exec(token.body[sideMarkerIndex].trim())?.[1] as MindNode["side"]
    : undefined;
  const sizeMarkerLine = token.body.find((line) => SIZE_MARKER_PATTERN.test(line.trim()));
  const sizeMatch = sizeMarkerLine ? SIZE_MARKER_PATTERN.exec(sizeMarkerLine.trim()) : null;
  const size = sizeMatch
    ? { width: Number(sizeMatch[1]), height: Number(sizeMatch[2]) }
    : undefined;
  const noteLines = token.body.filter((line, lineIndex) => (
    lineIndex !== sideMarkerIndex && !SIZE_MARKER_PATTERN.test(line.trim())
  ));

  return {
    id: createStableTestId("md", index),
    title: decodeHeadingTitle(token.title) || "Untitled",
    note: normalizeNote(noteLines),
    level: token.level,
    side,
    size,
    children: [],
  };
}

export function createDefaultRoot(title = "OpenMind"): MindNode {
  return {
    id: createNodeId("root"),
    title,
    note: "",
    level: 1,
    children: [],
  };
}

export function createDefaultDocument(title = "OpenMind"): DocumentState {
  const root = createDefaultRoot(title);
  const markdown = serializeMarkdown(root);
  return {
    id: createNodeId("task"),
    fileName: `${title || "openmind"}.md`,
    markdown,
    root,
    groupFrames: [],
    localModifiedAt: new Date().toISOString(),
    lastSavedMarkdown: markdown,
    saveStatus: "saved",
    warnings: [],
  };
}

export function parseMarkdown(markdown: string, fileName = "OpenMind.md"): ParseResult {
  const warnings: string[] = [];
  const normalized = markdown.replace(/\r\n/g, "\n");
  let framesEncoded: string | undefined;
  const lines = normalized.split("\n").filter((line) => {
    const framesMatch = FRAMES_MARKER_PATTERN.exec(line.trim());
    if (framesMatch) {
      framesEncoded = framesMatch[1];
      return false;
    }
    return true;
  });
  const root = buildRootFromLines(lines, fileName, warnings);
  return { root, warnings, groupFrames: decodeGroupFrames(root, framesEncoded) };
}

function buildRootFromLines(lines: string[], fileName: string, warnings: string[]): MindNode {
  const tokens: HeadingToken[] = [];
  const prelude: string[] = [];
  let current: HeadingToken | undefined;

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      current = { level: match[1].length, title: match[2].trim(), body: [] };
      tokens.push(current);
    } else if (current) {
      current.body.push(line);
    } else {
      prelude.push(line);
    }
  }

  const firstH1Index = tokens.findIndex((token) => token.level === 1);
  if (firstH1Index === -1) {
    warnings.push("Markdown has no H1; using file name as root.");
    const root = createDefaultRoot(titleFromFileName(fileName));
    root.note = normalizeNote(prelude);
    const pseudoTokens = tokens.map((token, index) => headingToNode(token, index));
    attachChildren(root, pseudoTokens);
    return root;
  }

  const h1Count = tokens.filter((token) => token.level === 1).length;
  if (h1Count > 1) {
    warnings.push(MULTIPLE_H1_NORMALIZED_WARNING);
    const root: MindNode = {
      id: createStableTestId("md", 0),
      title: "根主题",
      note: normalizeNote(prelude),
      level: 1,
      children: [],
    };
    const shiftedNodes = tokens.map((token, index) => headingToNode({
      ...token,
      level: Math.min(token.level + 1, 6),
    }, index + 1));
    attachChildren(root, shiftedNodes);
    return root;
  }

  const scopedTokens = tokens.slice(firstH1Index);
  const nodes = scopedTokens.map((token, index) => headingToNode(token, index));
  const root = nodes[0];
  attachChildren(root, nodes.slice(1));
  return root;
}

function attachChildren(root: MindNode, nodes: MindNode[]): void {
  const stack: MindNode[] = [root];
  for (const node of nodes) {
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1] ?? root;
    parent.children.push(node);
    stack.push(node);
  }
}

export function serializeMarkdown(root: MindNode, groupFrames: GroupFrame[] = []): string {
  const lines: string[] = [];

  function visit(node: MindNode): void {
    const level = Math.min(Math.max(node.level, 1), 6);
    lines.push(`${"#".repeat(level)} ${encodeHeadingTitle(node.title)}`, "");
    if (node.side) {
      lines.push(`<!-- openmind:side=${node.side} -->`, "");
    }
    if (node.size) {
      lines.push(`<!-- openmind:size=${Math.round(node.size.width)}x${Math.round(node.size.height)} -->`, "");
    }
    const note = node.note.trim();
    if (note) {
      lines.push(note, "");
    }
    node.children.forEach(visit);
  }

  visit(root);

  const framesMarker = encodeGroupFrames(root, groupFrames);
  if (framesMarker) {
    lines.push(framesMarker, "");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function listNodesInOrder(root: MindNode): MindNode[] {
  const ordered: MindNode[] = [];

  function visit(node: MindNode): void {
    ordered.push(node);
    node.children.forEach(visit);
  }

  visit(root);
  return ordered;
}

function encodeGroupFrames(root: MindNode, groupFrames: GroupFrame[]): string | undefined {
  if (!groupFrames.length) {
    return undefined;
  }

  const indexById = new Map<string, number>();
  listNodesInOrder(root).forEach((node, index) => indexById.set(node.id, index));

  const serialized: SerializedGroupFrame[] = groupFrames
    .map((frame) => {
      const indexes = frame.nodeIds
        .map((nodeId) => indexById.get(nodeId))
        .filter((index): index is number => index !== undefined)
        .sort((left, right) => left - right);
      return { n: indexes, note: frame.note };
    })
    .filter((frame) => frame.n.length > 0);

  if (!serialized.length) {
    return undefined;
  }

  return `<!-- openmind:frames=${encodeBase64Json(serialized)} -->`;
}

function decodeGroupFrames(root: MindNode, encoded?: string): GroupFrame[] {
  if (!encoded) {
    return [];
  }

  const parsed = decodeBase64Json<SerializedGroupFrame[]>(encoded);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const orderedNodes = listNodesInOrder(root);
  return parsed
    .map((frame, frameIndex): GroupFrame | undefined => {
      if (!frame || !Array.isArray(frame.n)) {
        return undefined;
      }
      const nodeIds = frame.n
        .map((index) => orderedNodes[index]?.id)
        .filter((nodeId): nodeId is string => typeof nodeId === "string");
      if (!nodeIds.length) {
        return undefined;
      }
      return {
        id: createStableTestId("frame", frameIndex),
        nodeIds,
        note: typeof frame.note === "string" ? frame.note : "备注",
      };
    })
    .filter((frame): frame is GroupFrame => frame !== undefined);
}

function encodeBase64Json(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64Json<T>(encoded: string): T | undefined {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return undefined;
  }
}
