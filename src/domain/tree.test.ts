import { describe, expect, it } from "vitest";
import type { MindNode } from "./types";
import { addChildNode, deleteNode, updateNodeNote, updateNodeTitle } from "./tree";

function fixture(): MindNode {
  return {
    id: "root",
    title: "Root",
    note: "",
    level: 1,
    children: [
      {
        id: "a",
        title: "A",
        note: "A note",
        level: 2,
        children: [
          { id: "a1", title: "A1", note: "", level: 3, children: [] },
        ],
      },
    ],
  };
}

describe("tree editing helpers", () => {
  it("adds a child below the requested parent with the next heading level capped at H6", () => {
    const root = addChildNode(fixture(), "a", "New node");

    expect(root.children[0].children.map((node) => node.title)).toEqual(["A1", "New node"]);
    expect(root.children[0].children[1].level).toBe(3);
  });

  it("updates titles and notes immutably", () => {
    const original = fixture();
    const renamed = updateNodeTitle(original, "a", "Renamed");
    const noted = updateNodeNote(renamed, "a1", "Nested note");

    expect(original.children[0].title).toBe("A");
    expect(renamed.children[0].title).toBe("Renamed");
    expect(noted.children[0].children[0].note).toBe("Nested note");
  });

  it("deletes a node with all descendants but protects the root", () => {
    const removed = deleteNode(fixture(), "a");
    const rootProtected = deleteNode(fixture(), "root");

    expect(removed.children).toEqual([]);
    expect(rootProtected.children).toHaveLength(1);
  });
});
