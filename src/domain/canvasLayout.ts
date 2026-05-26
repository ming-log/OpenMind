export interface CanvasSize {
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  scale: number;
}

export interface DropPoint {
  x: number;
  y: number;
}

export interface NodeRect {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function calculateCenteredPan(size: CanvasSize): { x: number; y: number } {
  return {
    x: (size.viewportWidth - size.contentWidth * size.scale) / 2,
    y: (size.viewportHeight - size.contentHeight * size.scale) / 2,
  };
}

export function findDropTarget(point: DropPoint, rects: NodeRect[], excludedIds: Set<string>): string | undefined {
  return rects.find((rect) => (
    !excludedIds.has(rect.id)
    && point.x >= rect.left
    && point.x <= rect.left + rect.width
    && point.y >= rect.top
    && point.y <= rect.top + rect.height
  ))?.id;
}
