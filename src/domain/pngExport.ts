import { DEFAULT_THEME_ID, getThemePreset, type BranchPalette, type ThemeExportNodePalette, type ThemeExportPalette, type ThemeId } from "./themes";
import type { MindNode } from "./types";

export interface PositionedNode {
  node: MindNode;
  x: number;
  y: number;
  height: number;
}

export interface LayoutOptions {
  topReserves?: ReadonlyMap<string, number>;
}

export const NODE_WIDTH = 270;
export const NODE_MIN_WIDTH = 96;
export const NODE_AUTO_MAX_WIDTH = 420;
export const ROOT_AUTO_MAX_WIDTH = 480;
export const NODE_MAX_WIDTH = 720;
export const NODE_MAX_HEIGHT = 480;
export const MIN_NODE_HEIGHT = 54;
export const ROOT_MIN_NODE_HEIGHT = 62;
export const NODE_HORIZONTAL_PADDING = 40;
export const TEXT_NODE_MIN_HEIGHT = 28;
export const TEXT_NODE_HORIZONTAL_PADDING = 18;
export const TEXT_NODE_MAX_WIDTH = 200;
export const TEXT_NODE_MIN_WIDTH = 18;
export const TEXT_NODE_NOTE_GAP = 4;
export const TEXT_NODE_NOTE_WIDTH = 14;
export const TEXT_NODE_NOTE_SPACE = TEXT_NODE_NOTE_GAP + TEXT_NODE_NOTE_WIDTH;
const ROOT_CONNECTOR_GAP = 30;
const TEXT_CONNECTOR_GAP = 28;
const Y_GAP = 24;
const PADDING = 80;
export const EXPORT_FONT_FAMILY = '"Times New Roman", "Microsoft YaHei", serif';
type TextMeasureContext = Pick<CanvasRenderingContext2D, "measureText">;

export function layoutTree(root: MindNode, options: LayoutOptions = {}): PositionedNode[] {
  const rootHeight = getNodeLayoutHeight(root, 0);
  const right = layoutBranch(root, root.children.filter((child) => child.side !== "left"), 1, options);
  const left = layoutBranch(root, root.children.filter((child) => child.side === "left"), -1, options);
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

function layoutBranch(root: MindNode, children: MindNode[], direction: 1 | -1, options: LayoutOptions): PositionedNode[] & { height: number; anchorY: number } {
  const positioned: PositionedNode[] = [];
  const anchors: number[] = [];
  let cursorY = 0;
  const rootWidth = getNodeLayoutWidth(root, 0);

  children.forEach((child) => {
    if (cursorY > 0) {
      cursorY += options.topReserves?.get(child.id) ?? 0;
    }
    const childWidth = getNodeLayoutWidth(child, 1);
    const childX = direction === 1
      ? rootWidth + ROOT_CONNECTOR_GAP
      : -ROOT_CONNECTOR_GAP - childWidth;
    const subtree = layoutSubtree(child, direction, 1, childX, options);
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

function layoutSubtree(node: MindNode, direction: 1 | -1, depth: number, x: number, options: LayoutOptions): SubtreeLayout {
  const height = getNodeLayoutHeight(node, depth);
  if (node.children.length === 0) {
    return {
      entries: [{ node, x, y: 0, height }],
      height,
      rootCenterY: height / 2,
    };
  }

  const childEntries: PositionedNode[] = [];
  const childCenters: number[] = [];
  let cursorY = 0;

  node.children.forEach((child) => {
    if (cursorY > 0) {
      cursorY += options.topReserves?.get(child.id) ?? 0;
    }
    const childWidth = getNodeLayoutWidth(child, depth + 1);
    const childX = direction === 1
      ? x + getNodeLayoutWidth(node, depth) + TEXT_CONNECTOR_GAP
      : x - TEXT_CONNECTOR_GAP - childWidth;
    const childLayout = layoutSubtree(child, direction, depth + 1, childX, options);
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
    x,
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

export function estimateTextNodeWidth(title: string): number {
  const widestLineWidth = estimateWidestTitleLineWidth(title);

  return Math.min(TEXT_NODE_MAX_WIDTH, Math.max(TEXT_NODE_MIN_WIDTH, widestLineWidth + TEXT_NODE_HORIZONTAL_PADDING));
}

export function calculateNodeHeight(
  node: MindNode,
  visualDepth = Math.max(node.level - 1, 0),
  layoutWidth = getNodeAutoWidth(node, visualDepth),
): number {
  const title = node.title.trim() || "Untitled";
  const lineCount = estimateTitleLineCount(title, getTitleContentWidth(layoutWidth, visualDepth));
  const lineHeight = visualDepth === 0 ? 20 : visualDepth === 1 ? 18 : 16;
  const verticalPadding = visualDepth === 0 ? 28 : visualDepth === 1 ? 24 : 10;
  const minimum = visualDepth === 0 ? ROOT_MIN_NODE_HEIGHT : visualDepth === 1 ? MIN_NODE_HEIGHT : TEXT_NODE_MIN_HEIGHT;
  return Math.max(minimum, lineCount * lineHeight + verticalPadding);
}

export function getNodeLayoutWidth(node: MindNode, visualDepth = Math.max(node.level - 1, 0)): number {
  if (node.size?.width) {
    return clampDimension(node.size.width, getNodeMinWidth(node, visualDepth), NODE_MAX_WIDTH);
  }

  return getNodeAutoWidth(node, visualDepth);
}

export function getNodeLayoutHeight(node: MindNode, visualDepth = Math.max(node.level - 1, 0)): number {
  const minimum = visualDepth === 0 ? ROOT_MIN_NODE_HEIGHT : visualDepth === 1 ? MIN_NODE_HEIGHT : TEXT_NODE_MIN_HEIGHT;
  const layoutWidth = getNodeLayoutWidth(node, visualDepth);
  return clampDimension(node.size?.height ?? calculateNodeHeight(node, visualDepth, layoutWidth), minimum, NODE_MAX_HEIGHT);
}

export function getNodeAutoWidth(node: MindNode, visualDepth = Math.max(node.level - 1, 0)): number {
  if (visualDepth > 1) {
    return estimateTextNodeWidth(node.title) + (node.note.trim() ? TEXT_NODE_NOTE_SPACE : 0);
  }

  const maximum = visualDepth === 0 ? ROOT_AUTO_MAX_WIDTH : NODE_AUTO_MAX_WIDTH;
  return clampDimension(estimateWidestTitleLineWidth(node.title) + NODE_HORIZONTAL_PADDING, NODE_WIDTH, maximum);
}

function getNodeMinWidth(node: MindNode, visualDepth: number): number {
  return visualDepth <= 1
    ? NODE_MIN_WIDTH
    : TEXT_NODE_MIN_WIDTH + TEXT_NODE_HORIZONTAL_PADDING + (node.note.trim() ? TEXT_NODE_NOTE_SPACE : 0);
}

function clampDimension(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function getTitleContentWidth(layoutWidth: number, visualDepth: number): number {
  return Math.max(1, layoutWidth - (visualDepth <= 1 ? NODE_HORIZONTAL_PADDING : TEXT_NODE_HORIZONTAL_PADDING));
}

function estimateWidestTitleLineWidth(title: string): number {
  const normalized = title.trim() || "Untitled";
  return Math.max(
    ...normalized.replace(/\r\n/g, "\n").split("\n").map((line) => (
      Array.from(line).reduce((sum, char) => sum + estimateTitleCharWidth(char), 0)
    )),
  );
}

function estimateTitleCharWidth(char: string): number {
  if (/\s/.test(char)) {
    return 4;
  }
  return /[\u0000-\u00ff]/.test(char) ? 7.5 : 14;
}

function estimateTitleLineCount(title: string, maxLineWidth: number): number {
  let lines = 0;

  for (const segment of title.replace(/\r\n/g, "\n").split("\n")) {
    let currentWidth = 0;
    let segmentLines = 1;

    for (const char of segment) {
      const charWidth = estimateTitleCharWidth(char);
      if (currentWidth > 0 && currentWidth + charWidth > maxLineWidth) {
        segmentLines += 1;
        currentWidth = charWidth;
      } else {
        currentWidth += charWidth;
      }
    }

    lines += segmentLines;
  }

  return Math.max(1, lines);
}

export function exportTreeAsPng(root: MindNode, fileName: string, themeId: ThemeId = DEFAULT_THEME_ID): void {
  const palette = getThemePreset(themeId).exportPalette;
  const nodes = layoutTree(root);
  const nodeDepths = getNodeDepths(root);
  const maxX = Math.max(...nodes.map((entry) => entry.x + getNodeLayoutWidth(entry.node, nodeDepths.get(entry.node.id)))) + PADDING * 2;
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
  drawExportBackground(context, maxX, maxY, palette);

  const byId = new Map(nodes.map((entry) => [entry.node.id, entry]));
  const rootEntry = byId.get(root.id) ?? nodes[0];
  const branchIndexById = getBranchIndices(root);
  context.lineWidth = 2;
  for (const entry of nodes) {
    const entryDepth = nodeDepths.get(entry.node.id) ?? Math.max(entry.node.level - 1, 0);
    const entryWidth = getNodeLayoutWidth(entry.node, entryDepth);
    for (const child of entry.node.children) {
      const childEntry = byId.get(child.id);
      if (!childEntry) continue;
      const childIsLeft = childEntry.x < entry.x;
      const childBranchSide = getExportBranchSide(childEntry, rootEntry);
      const childDepth = nodeDepths.get(childEntry.node.id) ?? Math.max(childEntry.node.level - 1, 0);
      const childWidth = getNodeLayoutWidth(childEntry.node, childDepth);
      const startX = PADDING + entry.x + (childIsLeft ? 0 : entryWidth);
      const startY = PADDING + entry.y + entry.height / 2;
      const endX = PADDING + childEntry.x + (childIsLeft ? childWidth : 0);
      const endY = PADDING + childEntry.y + childEntry.height / 2;
      const midX = (startX + endX) / 2;
      const branchEdge = getBranchPalette(palette, branchIndexById.get(childEntry.node.id))?.edge;
      context.strokeStyle = branchEdge ?? (childBranchSide === "left" ? palette.edgeLeft : palette.edgeRight);
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(midX, startY, midX, endY, endX, endY);
      context.stroke();
    }
  }

  for (const entry of nodes) {
    const x = PADDING + entry.x;
    const y = PADDING + entry.y;
    const nodeDepth = nodeDepths.get(entry.node.id) ?? Math.max(entry.node.level - 1, 0);
    const framed = entry.node.id === root.id || nodeDepth === 1;
    const nodePalette = getExportNodePalette(entry, rootEntry, palette, branchIndexById.get(entry.node.id));
    const nodeWidth = getNodeLayoutWidth(entry.node, nodeDepth);

    if (framed) {
      context.fillStyle = nodePalette.bg;
      context.strokeStyle = nodePalette.border;
      context.lineWidth = entry.node.id === root.id ? 3 : 1.5;
      roundRect(context, x, y, nodeWidth, entry.height, 12);
      context.fill();
      context.stroke();
    }

    context.fillStyle = framed ? nodePalette.text : palette.text;
    context.font = `${entry.node.id === root.id || nodeDepth === 1 ? "700" : "600"} ${entry.node.id === root.id ? 16 : nodeDepth === 1 ? 14 : 12}px ${EXPORT_FONT_FAMILY}`;
    drawCenteredWrappedText(context, entry.node.title, x + 16, y, nodeWidth - 32, entry.height, 18);
  }

  const link = document.createElement("a");
  link.download = fileName.replace(/\.md$/i, ".png") || "openmind.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function drawExportBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: ThemeExportPalette,
): void {
  context.fillStyle = palette.canvas;
  context.fillRect(0, 0, width, height);

  if (palette.pattern === "grid") {
    context.strokeStyle = palette.grid;
    context.lineWidth = 1;
    for (let x = 0.5; x < width; x += 32) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0.5; y < height; y += 32) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    return;
  }

  if (palette.pattern === "dots") {
    context.fillStyle = palette.grid;
    for (let y = 9; y < height; y += 18) {
      for (let x = 9; x < width; x += 18) {
        context.beginPath();
        context.arc(x, y, 1.1, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
}

function getExportBranchSide(entry: PositionedNode, rootEntry: PositionedNode): "root" | "left" | "right" {
  if (entry.node.id === rootEntry.node.id) {
    return "root";
  }
  return entry.x < rootEntry.x ? "left" : "right";
}

function getNodeDepths(root: MindNode): Map<string, number> {
  const depths = new Map<string, number>();

  function walk(node: MindNode, depth: number): void {
    depths.set(node.id, depth);
    node.children.forEach((child) => walk(child, depth + 1));
  }

  walk(root, 0);
  return depths;
}

function getBranchIndices(root: MindNode): Map<string, number> {
  const branchIndex = new Map<string, number>();

  function walk(node: MindNode, index: number): void {
    branchIndex.set(node.id, index);
    node.children.forEach((child) => walk(child, index));
  }

  root.children.forEach((child, index) => walk(child, index));
  return branchIndex;
}

function getBranchPalette(palette: ThemeExportPalette, branchIndex: number | undefined): BranchPalette | undefined {
  if (branchIndex === undefined || !palette.branches.length) {
    return undefined;
  }
  return palette.branches[branchIndex % palette.branches.length];
}

function getExportNodePalette(
  entry: PositionedNode,
  rootEntry: PositionedNode,
  palette: ThemeExportPalette,
  branchIndex?: number,
): ThemeExportNodePalette {
  const side = getExportBranchSide(entry, rootEntry);
  if (side === "root") {
    return palette.root;
  }
  const branchPalette = getBranchPalette(palette, branchIndex);
  if (branchPalette) {
    return branchPalette.node;
  }
  return side === "left" ? palette.nodeLeft : palette.nodeRight;
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
  const normalized = (text.trim() || "Untitled").replace(/\r\n/g, "\n");
  const rawLines = normalized
    .split("\n")
    .flatMap((segment) => {
      const normalizedSegment = segment.replace(/[^\S\n]+/g, " ").trim();
      return normalizedSegment ? wrapCanvasTextWithoutLimit(context, normalizedSegment, maxWidth) : [""];
    });
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
