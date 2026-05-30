import { describe, expect, it } from "vitest";
import type { MindNode } from "./types";
import { addChildNode, addParentNode, addSiblingNode, cloneSubtreeWithNewIds, collectSubtreeIds, deleteNode, deleteNodes, findSubtreeAnchorIds, insertSubtree, moveSubtree, reconcileFrameNodeIds, updateNodeNote, updateNodeTitle } from "./tree";

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

  it("inserts a new parent above a selected node while preserving the subtree", () => {
    const root = addParentNode(fixture(), "a1", "Parent", "parent");

    expect(root.children[0].children.map((node) => node.id)).toEqual(["parent"]);
    expect(root.children[0].children[0]).toMatchObject({
      id: "parent",
      title: "Parent",
      level: 3,
      children: [
        {
          id: "a1",
          level: 4,
        },
      ],
    });
  });

  it("ignores adding a parent above the root", () => {
    const original = fixture();

    expect(addParentNode(original, "root", "Parent")).toBe(original);
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
    const moved = moveSubtree(fixture(), "a", "b", 0);

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

  it("moves a node to a requested sibling position", () => {
    const moved = moveSubtree(fixture(), "b", "root", 0);

    expect(moved.children.map((node) => node.id)).toEqual(["b", "a"]);
    expect(moved.children[0].level).toBe(2);
    expect(moved.children[1].children.map((node) => node.id)).toEqual(["a1"]);
  });

  it("updates the side of a root-level subtree when moved across sides", () => {
    const root: MindNode = {
      id: "root",
      title: "Root",
      note: "",
      level: 1,
      children: [
        { id: "left", title: "Left", note: "", level: 2, side: "left", children: [] },
        {
          id: "right",
          title: "Right",
          note: "",
          level: 2,
          side: "right",
          children: [
            { id: "right-child", title: "Right child", note: "", level: 3, side: "right", children: [] },
          ],
        },
      ],
    };

    const moved = moveSubtree(root, "right", "root", 0, "left");

    expect(moved.children.map((node) => node.id)).toEqual(["right", "left"]);
    expect(moved.children[0].side).toBe("left");
    expect(moved.children[0].children[0].side).toBe("left");
  });

  it("keeps same-parent insertion indexes stable after removing the moved node", () => {
    const movedBeforeOriginalNextSibling = moveSubtree(fixture(), "a", "root", 1);
    const movedAfterOriginalPreviousSibling = moveSubtree(fixture(), "b", "root", 1);

    expect(movedBeforeOriginalNextSibling.children.map((node) => node.id)).toEqual(["a", "b"]);
    expect(movedAfterOriginalPreviousSibling.children.map((node) => node.id)).toEqual(["a", "b"]);
  });

  it("inserts a moved node at a requested child position", () => {
    const moved = moveSubtree(fixture(), "b", "a", 0);

    expect(moved.children.map((node) => node.id)).toEqual(["a"]);
    expect(moved.children[0].children.map((node) => node.id)).toEqual(["b", "a1"]);
    expect(moved.children[0].children[0].level).toBe(3);
    expect(moved.children[0].children[1].level).toBe(3);
  });

  it("ignores impossible subtree moves", () => {
    const original = fixture();

    expect(moveSubtree(original, "root", "a", 0)).toBe(original);
    expect(moveSubtree(original, "a", "a", 0)).toBe(original);
    expect(moveSubtree(original, "a", "a1", 0)).toBe(original);
    expect(moveSubtree(original, "missing", "b", 0)).toBe(original);
    expect(moveSubtree(original, "a", "missing", 0)).toBe(original);
  });

  it("collects selected nodes and all of their descendants for group frames", () => {
    expect(collectSubtreeIds(fixture(), ["a", "b"]).sort()).toEqual(["a", "a1", "b"]);
  });
});

describe("group frame reconciliation", () => {
  it("returns the topmost selected nodes as anchors", () => {
    const root = fixture();

    expect(findSubtreeAnchorIds(root, ["a", "a1"])).toEqual(["a"]);
    expect(findSubtreeAnchorIds(root, ["a1", "b"]).sort()).toEqual(["a1", "b"]);
  });

  it("re-expands a frame to cover newly added children of its anchors", () => {
    const root = fixture();
    const frameNodeIds = collectSubtreeIds(root, ["a"]);
    expect(frameNodeIds.sort()).toEqual(["a", "a1"]);

    const withNewChild = addChildNode(root, "a", "A2", "a2");
    const reconciled = reconcileFrameNodeIds(withNewChild, frameNodeIds);

    expect(reconciled.sort()).toEqual(["a", "a1", "a2"]);
  });

  it("drops frame ids whose anchors were deleted", () => {
    const root = fixture();
    const frameNodeIds = collectSubtreeIds(root, ["a"]);
    const withoutA = deleteNode(root, "a");

    expect(reconcileFrameNodeIds(withoutA, frameNodeIds)).toEqual([]);
  });
});

describe("copy and paste", () => {
  it("clones a subtree with fresh ids while keeping titles and notes", () => {
    const original = fixture().children[0];
    const clone = cloneSubtreeWithNewIds(original);

    expect(clone.id).not.toBe(original.id);
    expect(clone.children[0].id).not.toBe(original.children[0].id);
    expect(clone.title).toBe(original.title);
    expect(clone.note).toBe(original.note);
    expect(clone.children[0].title).toBe(original.children[0].title);
  });

  it("inserts a pasted subtree as a child with new ids and relevels it", () => {
    const root = fixture();
    const copied = findById(root, "a");
    const { root: nextRoot, insertedId } = insertSubtree(root, "b", copied!);

    const target = findById(nextRoot, "b");
    expect(target?.children).toHaveLength(1);
    const pasted = target!.children[0];
    expect(pasted.id).toBe(insertedId);
    expect(pasted.id).not.toBe("a");
    expect(pasted.title).toBe("A");
    expect(pasted.level).toBe(3);
    expect(pasted.children[0].level).toBe(4);
    // original subtree stays intact
    expect(findById(nextRoot, "a")?.children).toHaveLength(1);
  });
});

function findById(node: MindNode, id: string): MindNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return undefined;
}
