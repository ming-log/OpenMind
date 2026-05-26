import { describe, expect, it } from "vitest";
import type { MindNode } from "./types";
import { addChildNode, addSiblingNode, deleteNode, deleteNodes, moveSubtree, updateNodeNote, updateNodeTitle } from "./tree";

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
      {
        id: "b",
        title: "B",
        note: "",
        level: 2,
        children: [],
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

  it("adds a sibling immediately below the requested node", () => {
    const root = addSiblingNode(fixture(), "a", "Inserted", "inserted");
    const nested = addSiblingNode(fixture(), "a1", "A2", "a2");

    expect(root.children.map((node) => node.title)).toEqual(["A", "Inserted", "B"]);
    expect(root.children[1]).toMatchObject({
      id: "inserted",
      title: "Inserted",
      note: "",
      level: 2,
      children: [],
    });
    expect(nested.children[0].children.map((node) => node.title)).toEqual(["A1", "A2"]);
    expect(nested.children[0].children[1].level).toBe(3);
  });

  it("adds a child when a sibling is requested for the root", () => {
    const root = addSiblingNode(fixture(), "root", "Main topic", "main");

    expect(root.children.map((node) => node.title)).toEqual(["A", "B", "Main topic"]);
    expect(root.children[2].level).toBe(2);
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

    expect(removed.children.map((node) => node.id)).toEqual(["b"]);
    expect(rootProtected.children).toHaveLength(2);
  });

  it("deletes multiple nodes in one immutable edit while protecting the root", () => {
    const removed = deleteNodes(fixture(), ["root", "a1", "b"]);

    expect(removed.id).toBe("root");
    expect(removed.children.map((node) => node.id)).toEqual(["a"]);
    expect(removed.children[0].children).toEqual([]);
  });

  it("moves a node and all descendants below a new parent while recalculating levels", () => {
    const moved = moveSubtree(fixture(), "a", "b");

    expect(moved.children.map((node) => node.id)).toEqual(["b"]);
    expect(moved.children[0].children.map((node) => node.id)).toEqual(["a"]);
    expect(moved.children[0].children[0]).toMatchObject({
      id: "a",
      level: 3,
      children: [
        {
          id: "a1",
          level: 4,
        },
      ],
    });
  });

  it("ignores impossible subtree moves", () => {
    const original = fixture();

    expect(moveSubtree(original, "root", "a")).toBe(original);
    expect(moveSubtree(original, "a", "a")).toBe(original);
    expect(moveSubtree(original, "a", "a1")).toBe(original);
    expect(moveSubtree(original, "missing", "b")).toBe(original);
    expect(moveSubtree(original, "a", "missing")).toBe(original);
  });
});
