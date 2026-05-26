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

export interface DropNodeRect extends NodeRect {
  parentId: string;
  index: number;
}

export interface DropIntent {
  parentId: string;
  index: number;
  placement: "before" | "after" | "inside";
  targetId: string;
  side?: "left" | "right";
}

export interface FitCanvasSize extends CanvasSize {
  minScale: number;
  maxScale: number;
  margin: number;
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

export function findDropIntent(point: DropPoint, rects: DropNodeRect[], excludedIds: Set<string>): DropIntent | undefined {
  const eligibleRects = rects.filter((rect) => !excludedIds.has(rect.id));
  const containing = eligibleRects.find((rect) => containsPoint(point, rect));
  if (containing) {
    if (point.x >= containing.left + containing.width * 0.75 || point.x <= containing.left + containing.width * 0.25) {
      return {
        parentId: containing.id,
        index: childCount(containing.id, rects),
        placement: "inside",
        targetId: containing.id,
        side: point.x < containing.left + containing.width / 2 ? "left" : "right",
      };
    }

    return {
      parentId: containing.parentId,
      index: point.y < containing.top + containing.height / 2 ? containing.index : containing.index + 1,
      placement: point.y < containing.top + containing.height / 2 ? "before" : "after",
      targetId: containing.id,
    };
  }

  const laneParent = eligibleRects.find((rect) => (
    ((point.x > rect.left + rect.width && point.x <= rect.left + rect.width + 80)
      || (point.x < rect.left && point.x >= rect.left - 80))
    && point.y >= rect.top
    && point.y <= rect.top + rect.height
  ));
  if (!laneParent) {
    return undefined;
  }

  return {
    parentId: laneParent.id,
    index: childCount(laneParent.id, rects),
    placement: "inside",
    targetId: laneParent.id,
    side: point.x < laneParent.left ? "left" : "right",
  };
}

export function calculateFitScale(size: FitCanvasSize): number {
  const availableWidth = Math.max(1, size.viewportWidth - size.margin * 2);
  const availableHeight = Math.max(1, size.viewportHeight - size.margin * 2);
  const fitScale = Math.min(availableWidth / size.contentWidth, availableHeight / size.contentHeight);
  return Math.min(size.maxScale, Math.max(size.minScale, fitScale));
}

function containsPoint(point: DropPoint, rect: NodeRect): boolean {
  return point.x >= rect.left
    && point.x <= rect.left + rect.width
    && point.y >= rect.top
    && point.y <= rect.top + rect.height;
}

function childCount(parentId: string, rects: DropNodeRect[]): number {
  return rects.filter((rect) => rect.parentId === parentId).length;
}
