import { describe, expect, it } from "vitest";
import { calculateCenteredPan, calculateFitScale, calculatePanForZoomAtPoint, findDropIntent, findDropTarget } from "./canvasLayout";

describe("canvas layout helpers", () => {
  it("centers the tree bounds inside the viewport at the current scale", () => {
    expect(calculateCenteredPan({
      viewportWidth: 800,
      viewportHeight: 600,
      contentWidth: 500,
      contentHeight: 300,
      scale: 1,
    })).toEqual({ x: 150, y: 150 });

    expect(calculateCenteredPan({
      viewportWidth: 800,
      viewportHeight: 600,
      contentWidth: 500,
      contentHeight: 300,
      scale: 0.5,
    })).toEqual({ x: 275, y: 225 });
  });

  it("finds a valid node under the pointer while excluding the moved subtree", () => {
    const rects = [
      { id: "a", left: 10, top: 10, width: 100, height: 60 },
      { id: "a1", left: 130, top: 10, width: 100, height: 60 },
      { id: "b", left: 250, top: 10, width: 100, height: 60 },
    ];

    expect(findDropTarget({ x: 145, y: 40 }, rects, new Set(["a", "a1"]))).toBeUndefined();
    expect(findDropTarget({ x: 280, y: 40 }, rects, new Set(["a", "a1"]))).toBe("b");
    expect(findDropTarget({ x: 500, y: 40 }, rects, new Set(["a", "a1"]))).toBeUndefined();
  });

  it("returns sibling drop intents above and below a target node", () => {
    const rects = [
      { id: "a", parentId: "root", index: 0, left: 10, top: 10, width: 100, height: 60 },
      { id: "b", parentId: "root", index: 1, left: 10, top: 90, width: 100, height: 60 },
    ];

    expect(findDropIntent({ x: 40, y: 20 }, rects, new Set(["dragged"]))).toEqual({
      parentId: "root",
      index: 0,
      placement: "before",
      targetId: "a",
    });
    expect(findDropIntent({ x: 40, y: 135 }, rects, new Set(["dragged"]))).toEqual({
      parentId: "root",
      index: 2,
      placement: "after",
      targetId: "b",
    });
  });

  it("returns child drop intents on the right side of a node or its child lane", () => {
    const rects = [
      { id: "a", parentId: "root", index: 0, left: 10, top: 40, width: 100, height: 60 },
      { id: "a1", parentId: "a", index: 0, left: 160, top: 20, width: 100, height: 60 },
    ];

    expect(findDropIntent({ x: 95, y: 65 }, rects, new Set(["dragged"]))).toEqual({
      parentId: "a",
      index: 1,
      placement: "inside",
      targetId: "a",
      side: "right",
    });
    expect(findDropIntent({ x: 145, y: 92 }, rects, new Set(["dragged"]))).toEqual({
      parentId: "a",
      index: 1,
      placement: "inside",
      targetId: "a",
      side: "right",
    });
  });

  it("keeps the map point under the pointer stable while zooming", () => {
    const point = { x: 300, y: 250 };
    const pan = { x: 100, y: 50 };
    const currentScale = 1;
    const nextScale = 2;
    const nextPan = calculatePanForZoomAtPoint({ pan, point, currentScale, nextScale });
    const mapX = (point.x - pan.x) / currentScale;
    const mapY = (point.y - pan.y) / currentScale;

    expect(nextPan).toEqual({ x: -100, y: -150 });
    expect(nextPan.x + mapX * nextScale).toBe(point.x);
    expect(nextPan.y + mapY * nextScale).toBe(point.y);
  });

  it("keeps the map point under the pointer stable while zooming out", () => {
    const point = { x: 320, y: 180 };
    const pan = { x: -80, y: -220 };
    const currentScale = 2;
    const nextScale = 0.5;
    const nextPan = calculatePanForZoomAtPoint({ pan, point, currentScale, nextScale });
    const mapX = (point.x - pan.x) / currentScale;
    const mapY = (point.y - pan.y) / currentScale;

    expect(nextPan.x + mapX * nextScale).toBe(point.x);
    expect(nextPan.y + mapY * nextScale).toBe(point.y);
  });

  it("calculates a bounded scale that fits the whole map inside the viewport", () => {
    expect(calculateFitScale({
      viewportWidth: 1000,
      viewportHeight: 700,
      contentWidth: 2000,
      contentHeight: 600,
      scale: 1,
      minScale: 0.35,
      maxScale: 1.8,
      margin: 40,
    })).toBe(0.46);

    expect(calculateFitScale({
      viewportWidth: 1200,
      viewportHeight: 900,
      contentWidth: 200,
      contentHeight: 160,
      scale: 1,
      minScale: 0.35,
      maxScale: 1.8,
      margin: 40,
    })).toBe(1.8);
  });

  it("returns child drop intents on the left side of a node or its child lane", () => {
    const rects = [
      { id: "root", parentId: "root", index: 0, left: 120, top: 40, width: 100, height: 60 },
    ];

    expect(findDropIntent({ x: 130, y: 65 }, rects, new Set(["dragged"]))).toEqual({
      parentId: "root",
      index: 1,
      placement: "inside",
      targetId: "root",
      side: "left",
    });
    expect(findDropIntent({ x: 75, y: 92 }, rects, new Set(["dragged"]))).toEqual({
      parentId: "root",
      index: 1,
      placement: "inside",
      targetId: "root",
      side: "left",
    });
  });

  it("keeps the target side when dropping at a root-level sibling position", () => {
    const rects = [
      { id: "root", parentId: "root", index: 0, left: 120, top: 80, width: 100, height: 60 },
      { id: "right", parentId: "root", index: 0, left: 250, top: 20, width: 100, height: 60, side: "right" as const },
      { id: "left", parentId: "root", index: 1, left: 0, top: 120, width: 100, height: 60, side: "left" as const },
    ];

    expect(findDropIntent({ x: 48, y: 132 }, rects, new Set(["right"]))).toEqual({
      parentId: "root",
      index: 1,
      placement: "before",
      targetId: "left",
      side: "left",
    });
  });
});
