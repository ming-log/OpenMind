import { describe, expect, it } from "vitest";
import { calculateCenteredPan, findDropIntent, findDropTarget } from "./canvasLayout";

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
    });
    expect(findDropIntent({ x: 145, y: 92 }, rects, new Set(["dragged"]))).toEqual({
      parentId: "a",
      index: 1,
      placement: "inside",
      targetId: "a",
    });
  });
});
