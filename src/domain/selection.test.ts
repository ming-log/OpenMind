import { describe, expect, it } from "vitest";
import { getIntersectingNodeIds, normalizeSelectionBox } from "./selection";

describe("selection geometry", () => {
  it("normalizes selection boxes dragged in any direction", () => {
    expect(normalizeSelectionBox({ startX: 160, startY: 90, endX: 20, endY: 30 })).toEqual({
      left: 20,
      top: 30,
      right: 160,
      bottom: 90,
    });
  });

  it("returns nodes whose screen-space rectangles intersect the selection box", () => {
    const nodes = [
      { id: "a", left: 20, top: 20, width: 100, height: 50 },
      { id: "b", left: 180, top: 20, width: 100, height: 50 },
      { id: "c", left: 80, top: 95, width: 100, height: 50 },
    ];

    expect(getIntersectingNodeIds({ startX: 150, startY: 85, endX: 0, endY: 0 }, nodes)).toEqual(["a"]);
  });
});
