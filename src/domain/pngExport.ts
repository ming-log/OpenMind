import type { MindNode } from "./types";

export interface PositionedNode {
  node: MindNode;
  x: number;
  y: number;
  height: number;
}

export const NODE_WIDTH = 180;
export const MIN_NODE_HEIGHT = 54;
export const ROOT_MIN_NODE_HEIGHT = 62;
const X_GAP = 210;
const Y_GAP = 32;
const PADDING = 80;
export const EXPORT_FONT_FAMILY = '"Times New Roman", "Microsoft YaHei", serif';
type TextMeasureContext = Pick<CanvasRenderingContext2D, "measureText">;

export function layoutTree(root: MindNode): PositionedNode[] {
  const rootHeight = calculateNodeHeight(root);
  const right = layoutBranch(root.children.filter((child) => child.side !== "left"), 1);
  const left = layoutBranch(root.children.filter((child) => child.side === "left"), -1);
  const normalizedRight = right.map((entry) => ({
    node: entry.node,
    x: entry.x,
    y: entry.y - right.anchorY + rootHeight / 2,
    height: entry.height,
  }));
  const normalizedLeft = left.map((entry) => ({
    node: entry.node,
    x: entry.x,
    y: entry.y - left.anchorY + rootHeight / 2,
    height: entry.height,
  }));
  const minX = Math.min(0, ...normalizedRight.map((entry) => entry.x), ...normalizedLeft.map((entry) => entry.x));
  const minY = Math.min(0, ...normalizedRight.map((entry) => entry.y), ...normalizedLeft.map((entry) => entry.y));

  return [
    { node: root, x: -minX, y: -minY, height: rootHeight },
    ...normalizedRight.map((entry) => ({ node: entry.node, x: entry.x - minX, y: entry.y - minY, height: entry.height })),
    ...normalizedLeft.map((entry) => ({ node: entry.node, x: entry.x - minX, y: entry.y - minY, height: entry.height })),
  ];
}

function layoutBranch(children: MindNode[], direction: 1 | -1): PositionedNode[] & { height: number; anchorY: number } {
  const positioned: PositionedNode[] = [];
  const anchors: number[] = [];
  let cursorY = 0;

  children.forEach((child) => {
    const subtree = layoutSubtree(child, direction, 1);
    subtree.entries.forEach((entry) => {
      positioned.push({ ...entry, y: entry.y + cursorY });
    });
    anchors.push(subtree.rootCenterY + cursorY);
    cursorY += subtree.height + Y_GAP;
  });
  return Object.assign(positioned, {
    height: Math.max(0, cursorY - Y_GAP),
    anchorY: anchors.length ? anchors.reduce((sum, y) => sum + y, 0) / anchors.length : 0,
  });
}

interface SubtreeLayout {
  entries: PositionedNode[];
  height: number;
  rootCenterY: number;
}

function layoutSubtree(node: MindNode, direction: 1 | -1, depth: number): SubtreeLayout {
  const height = calculateNodeHeight(node);
  if (node.children.length === 0) {
    return {
      entries: [{ node, x: direction * depth * X_GAP, y: 0, height }],
      height,
      rootCenterY: height / 2,
    };
  }

  const childEntries: PositionedNode[] = [];
  const childCenters: number[] = [];
  let cursorY = 0;

  node.children.forEach((child) => {
    const childLayout = layoutSubtree(child, direction, depth + 1);
    childLayout.entries.forEach((entry) => {
      childEntries.push({ ...entry, y: entry.y + cursorY });
    });
    childCenters.push(childLayout.rootCenterY + cursorY);
    cursorY += childLayout.height + Y_GAP;
  });

  const childrenHeight = Math.max(0, cursorY - Y_GAP);
  const firstCenter = childCenters[0] ?? height / 2;
  const lastCenter = childCenters[childCenters.length - 1] ?? height / 2;
  const rootCenterY = (firstCenter + lastCenter) / 2;
  const rootY = rootCenterY - height / 2;
  const top = Math.min(rootY, 0);
  const bottom = Math.max(rootY + height, childrenHeight);
  const offsetY = -top;
  const rootEntry: PositionedNode = {
    node,
    x: direction * depth * X_GAP,
    y: rootY + offsetY,
    height,
  };

  return {
    entries: [
      ...childEntries.map((entry) => ({ ...entry, y: entry.y + offsetY })),
      rootEntry,
    ],
    height: bottom - top,
    rootCenterY: rootCenterY + offsetY,
  };
}

export function calculateNodeHeight(node: MindNode): number {
  const title = node.title.trim() || "Untitled";
  const lineCount = estimateTitleLineCount(title);
  const lineHeight = node.level === 1 ? 20 : 19;
  const verticalPadding = node.level === 1 ? 28 : 24;
  const minimum = node.level === 1 ? ROOT_MIN_NODE_HEIGHT : MIN_NODE_HEIGHT;
  return Math.max(minimum, lineCount * lineHeight + verticalPadding);
}

function estimateTitleLineCount(title: string): number {
  const maxUnitsPerLine = 10;
  let lines = 1;
  let currentUnits = 0;

  for (const char of title) {
    const units = /[\u0000-\u00ff]/.test(char) ? 0.55 : 1;
    if (/\s/.test(char)) {
      currentUnits += 0.35;
    } else {
      currentUnits += units;
    }

    if (currentUnits > maxUnitsPerLine) {
      lines += 1;
      currentUnits = units;
    }
  }

  return Math.min(8, lines);
}

export function exportTreeAsPng(root: MindNode, fileName: string): void {
  const nodes = layoutTree(root);
  const maxX = Math.max(...nodes.map((entry) => entry.x)) + NODE_WIDTH + PADDING * 2;
  const maxY = Math.max(...nodes.map((entry) => entry.y + entry.height)) + PADDING * 2;
  const canvas = document.createElement("canvas");
  const scale = window.devicePixelRatio || 1;
  canvas.width = maxX * scale;
  canvas.height = maxY * scale;
  canvas.style.width = `${maxX}px`;
  canvas.style.height = `${maxY}px`;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("PNG export failed: canvas is unavailable.");
  }
  context.scale(scale, scale);
  context.fillStyle = "#f8f6ef";
  context.fillRect(0, 0, maxX, maxY);

  const byId = new Map(nodes.map((entry) => [entry.node.id, entry]));
  context.strokeStyle = "#a8b6a4";
  context.lineWidth = 2;
  for (const entry of nodes) {
    for (const child of entry.node.children) {
      const childEntry = byId.get(child.id);
      if (!childEntry) continue;
      const childIsLeft = childEntry.x < entry.x;
      const startX = PADDING + entry.x + (childIsLeft ? 0 : NODE_WIDTH);
      const startY = PADDING + entry.y + entry.height / 2;
      const endX = PADDING + childEntry.x + (childIsLeft ? NODE_WIDTH : 0);
      const endY = PADDING + childEntry.y + childEntry.height / 2;
      const midX = (startX + endX) / 2;
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(midX, startY, midX, endY, endX, endY);
      context.stroke();
    }
  }

  for (const entry of nodes) {
    const x = PADDING + entry.x;
    const y = PADDING + entry.y;
    context.fillStyle = "#fffdf8";
    context.strokeStyle = entry.node.level === 1 ? "#255c4a" : "#365348";
    context.lineWidth = entry.node.level === 1 ? 3 : 1.5;
    roundRect(context, x, y, NODE_WIDTH, entry.height, 12);
    context.fill();
    context.stroke();
    context.fillStyle = "#1f2d28";
    context.font = `${entry.node.level === 1 ? "700" : "600"} 15px ${EXPORT_FONT_FAMILY}`;
    drawCenteredWrappedText(context, entry.node.title, x + 16, y, NODE_WIDTH - 32, entry.height, 18);
  }

  const link = document.createElement("a");
  link.download = fileName.replace(/\.md$/i, ".png") || "openmind.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawCenteredWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, height: number, lineHeight: number): void {
  const maxLines = Math.max(1, Math.floor((height - 16) / lineHeight));
  const lines = wrapCanvasTextLines(context, text, maxWidth, maxLines);
  context.textBaseline = "middle";
  const firstLineY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((textLine, index) => {
    context.fillText(textLine, x, firstLineY + index * lineHeight);
  });
}

export function wrapCanvasTextLines(
  context: TextMeasureContext,
  text: string,
  maxWidth: number,
  maxLines = Number.POSITIVE_INFINITY,
): string[] {
  const normalized = (text.trim() || "Untitled").replace(/\s+/g, " ");
  const rawLines = wrapCanvasTextWithoutLimit(context, normalized, maxWidth);
  const lineLimit = Math.max(1, Math.floor(maxLines));
  if (rawLines.length <= lineLimit) {
    return rawLines;
  }

  const visibleLines = rawLines.slice(0, lineLimit);
  visibleLines[visibleLines.length - 1] = fitLineWithEllipsis(context, visibleLines[visibleLines.length - 1], maxWidth);
  return visibleLines;
}

function wrapCanvasTextWithoutLimit(context: TextMeasureContext, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      const wordLines = breakTokenByWidth(context, word, maxWidth);
      lines.push(...wordLines.slice(0, -1));
      currentLine = wordLines[wordLines.length - 1] ?? "";
      continue;
    }

    const candidate = `${currentLine} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    const wordLines = breakTokenByWidth(context, word, maxWidth);
    lines.push(...wordLines.slice(0, -1));
    currentLine = wordLines[wordLines.length - 1] ?? "";
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : ["Untitled"];
}

function breakTokenByWidth(context: TextMeasureContext, token: string, maxWidth: number): string[] {
  if (context.measureText(token).width <= maxWidth) {
    return [token];
  }

  const lines: string[] = [];
  let currentLine = "";
  for (const char of Array.from(token)) {
    const candidate = `${currentLine}${char}`;
    if (!currentLine || context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = char;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function fitLineWithEllipsis(context: TextMeasureContext, line: string, maxWidth: number): string {
  const ellipsis = "...";
  if (context.measureText(`${line}${ellipsis}`).width <= maxWidth) {
    return `${line}${ellipsis}`;
  }

  const chars = Array.from(line);
  while (chars.length && context.measureText(`${chars.join("")}${ellipsis}`).width > maxWidth) {
    chars.pop();
  }

  return chars.length ? `${chars.join("")}${ellipsis}` : ellipsis;
}
