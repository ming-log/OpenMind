import { describe, expect, it } from "vitest";
import { calculateCenteredPan, findDropTarget } from "./canvasLayout";

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
});
