import { createNodeId, createStableTestId } from "./ids";
import type { DocumentState, MindNode, ParseResult } from "./types";

interface HeadingToken {
  level: number;
  title: string;
  body: string[];
}

export const MULTIPLE_H1_NORMALIZED_WARNING = "Markdown has multiple H1 headings; wrapped them under 根主题.";

const SIDE_MARKER_PATTERN = /^<!--\s*openmind:side=(left|right)\s*-->\s*$/;
const SIZE_MARKER_PATTERN = /^<!--\s*openmind:size=(\d+)x(\d+)\s*-->\s*$/;

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
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
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
    return { root, warnings };
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
    return { root, warnings };
  }

  const scopedTokens = tokens.slice(firstH1Index);
  const nodes = scopedTokens.map((token, index) => headingToNode(token, index));
  const root = nodes[0];
  attachChildren(root, nodes.slice(1));
  return { root, warnings };
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

export function serializeMarkdown(root: MindNode): string {
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
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
