import type { MindNode } from "./types";

export interface PositionedNode {
  node: MindNode;
  x: number;
  y: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 54;
const X_GAP = 210;
const Y_GAP = 86;
const PADDING = 80;

export function layoutTree(root: MindNode): PositionedNode[] {
  const right = layoutBranch(root.children.filter((child) => child.side !== "left"), 1);
  const left = layoutBranch(root.children.filter((child) => child.side === "left"), -1);
  const normalizedRight = right.map((entry) => ({ node: entry.node, x: entry.x, y: entry.y - right.anchorY }));
  const normalizedLeft = left.map((entry) => ({ node: entry.node, x: entry.x, y: entry.y - left.anchorY }));
  const minX = Math.min(0, ...normalizedRight.map((entry) => entry.x), ...normalizedLeft.map((entry) => entry.x));
  const minY = Math.min(0, ...normalizedRight.map((entry) => entry.y), ...normalizedLeft.map((entry) => entry.y));

  return [
    { node: root, x: -minX, y: -minY },
    ...normalizedRight.map((entry) => ({ node: entry.node, x: entry.x - minX, y: entry.y - minY })),
    ...normalizedLeft.map((entry) => ({ node: entry.node, x: entry.x - minX, y: entry.y - minY })),
  ];
}

function layoutBranch(children: MindNode[], direction: 1 | -1): PositionedNode[] & { height: number; anchorY: number } {
  const positioned: PositionedNode[] = [];
  const anchors: number[] = [];
  let leafIndex = 0;

  function walk(node: MindNode, depth: number): number {
    if (node.children.length === 0) {
      const y = leafIndex * Y_GAP;
      leafIndex += 1;
      positioned.push({ node, x: direction * depth * X_GAP, y });
      if (depth === 1) anchors.push(y);
      return y;
    }

    const childYs = node.children.map((child) => walk(child, depth + 1));
    const y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    positioned.push({ node, x: direction * depth * X_GAP, y });
    if (depth === 1) anchors.push(y);
    return y;
  }

  children.forEach((child) => walk(child, 1));
  return Object.assign(positioned, {
    height: Math.max(0, leafIndex - 1) * Y_GAP + NODE_HEIGHT,
    anchorY: anchors.length ? anchors.reduce((sum, y) => sum + y, 0) / anchors.length : 0,
  });
}

export function exportTreeAsPng(root: MindNode, fileName: string): void {
  const nodes = layoutTree(root);
  const maxX = Math.max(...nodes.map((entry) => entry.x)) + NODE_WIDTH + PADDING * 2;
  const maxY = Math.max(...nodes.map((entry) => entry.y)) + NODE_HEIGHT + PADDING * 2;
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
      const startY = PADDING + entry.y + NODE_HEIGHT / 2;
      const endX = PADDING + childEntry.x + (childIsLeft ? NODE_WIDTH : 0);
      const endY = PADDING + childEntry.y + NODE_HEIGHT / 2;
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
    roundRect(context, x, y, NODE_WIDTH, NODE_HEIGHT, 12);
    context.fill();
    context.stroke();
    context.fillStyle = "#1f2d28";
    context.font = `${entry.node.level === 1 ? "700" : "600"} 15px Georgia, serif`;
    drawCenteredWrappedText(context, entry.node.title, x + 16, y, NODE_WIDTH - 32, NODE_HEIGHT, 18);
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
  const words = text.split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length > 1) break;
    } else {
      line = testLine;
    }
  }
  if (line && lines.length <= 1) {
    lines.push(line);
  }
  context.textBaseline = "middle";
  const firstLineY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((textLine, index) => {
    context.fillText(textLine, x, firstLineY + index * lineHeight);
  });
}
