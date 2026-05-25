import { createNodeId, createStableTestId } from "./ids";
import type { DocumentState, MindNode, ParseResult } from "./types";

interface HeadingToken {
  level: number;
  title: string;
  body: string[];
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "OpenMind";
}

function normalizeNote(lines: string[]): string {
  return lines.join("\n").trim();
}

function headingToNode(token: HeadingToken, index: number): MindNode {
  return {
    id: createStableTestId("md", index),
    title: token.title || "Untitled",
    note: normalizeNote(token.body),
    level: token.level,
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
    fileName: `${title || "openmind"}.md`,
    markdown,
    root,
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

  const scopedTokens = tokens.slice(firstH1Index);
  const hasAdditionalH1 = scopedTokens.some((token, index) => index > 0 && token.level === 1);
  if (hasAdditionalH1) {
    warnings.push("Markdown has multiple H1 headings; additional H1 sections were parsed under the first root.");
  }

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
    lines.push(`${"#".repeat(level)} ${node.title.trim() || "Untitled"}`, "");
    const note = node.note.trim();
    if (note) {
      lines.push(note, "");
    }
    node.children.forEach(visit);
  }

  visit(root);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
