export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SelectableNodeRect {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function normalizeSelectionBox(box: SelectionBox): Rect {
  return {
    left: Math.min(box.startX, box.endX),
    top: Math.min(box.startY, box.endY),
    right: Math.max(box.startX, box.endX),
    bottom: Math.max(box.startY, box.endY),
  };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function getIntersectingNodeIds(box: SelectionBox, nodes: SelectableNodeRect[]): string[] {
  const selection = normalizeSelectionBox(box);

  return nodes
    .filter((node) => intersects(selection, {
      left: node.left,
      top: node.top,
      right: node.left + node.width,
      bottom: node.top + node.height,
    }))
    .map((node) => node.id);
}
