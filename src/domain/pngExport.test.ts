import { describe, expect, it } from "vitest";
import { layoutTree } from "./pngExport";
import type { MindNode } from "./types";

describe("layoutTree", () => {
  it("aligns the root with first-level nodes on both sides", () => {
    const root: MindNode = {
      id: "root",
      title: "Root",
      note: "",
      level: 1,
      children: [
        {
          id: "left",
          title: "Left",
          note: "",
          level: 2,
          side: "left",
          children: [],
        },
        {
          id: "right",
          title: "Right",
          note: "",
          level: 2,
          side: "right",
          children: [
            { id: "right-a", title: "Right A", note: "", level: 3, side: "right", children: [] },
            { id: "right-b", title: "Right B", note: "", level: 3, side: "right", children: [] },
          ],
        },
      ],
    };

    const byId = new Map(layoutTree(root).map((entry) => [entry.node.id, entry]));

    expect(byId.get("left")?.y).toBe(byId.get("root")?.y);
    expect(byId.get("right")?.y).toBe(byId.get("root")?.y);
  });
});
