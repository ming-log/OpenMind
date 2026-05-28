import { createNodeId } from "./ids";
import type { MindNode } from "./types";

type NodeUpdater = (node: MindNode) => MindNode;
type NodeSide = NonNullable<MindNode["side"]>;

function createEmptyNode(level: number, title: string, nodeId = createNodeId("node"), side?: NodeSide): MindNode {
  return {
    id: nodeId,
    title,
    note: "",
    level,
    side,
    children: [],
  };
}

function mapNode(node: MindNode, targetId: string, updater: NodeUpdater): MindNode {
  if (node.id === targetId) {
    return updater(node);
  }

  return {
    ...node,
    children: node.children.map((child) => mapNode(child, targetId, updater)),
  };
}

export function addChildNode(root: MindNode, parentId: string, title = "New node", nodeId?: string, side?: NodeSide): MindNode {
  return mapNode(root, parentId, (node) => ({
    ...node,
    children: [
      ...node.children,
      createEmptyNode(Math.min(node.level + 1, 6), title, nodeId, node.id === root.id ? side ?? "right" : node.side),
    ],
  }));
}

export function addSiblingNode(root: MindNode, targetId: string, title = "New node", nodeId?: string): MindNode {
  if (root.id === targetId) {
    return addChildNode(root, root.id, title, nodeId);
  }

  function insertBelow(node: MindNode): MindNode {
    const children = node.children.flatMap((child) => {
      const nextChild = insertBelow(child);
      if (child.id === targetId) {
        return [nextChild, createEmptyNode(child.level, title, nodeId, child.side)];
      }
      return [nextChild];
    });

    return {
      ...node,
      children,
    };
  }

  return insertBelow(root);
}

export function addParentNode(root: MindNode, targetId: string, title = "New node", nodeId?: string): MindNode {
  if (root.id === targetId) {
    return root;
  }

  function insertAbove(node: MindNode): MindNode {
    const children = node.children.map((child) => {
      if (child.id !== targetId) {
        return insertAbove(child);
      }

      const nextParent = createEmptyNode(child.level, title, nodeId, child.side);
      return {
        ...nextParent,
        children: [relevelSubtree(child, Math.min(child.level + 1, 6), child.side)],
      };
    });

    return {
      ...node,
      children,
    };
  }

  return insertAbove(root);
}

export function updateNodeTitle(root: MindNode, nodeId: string, title: string): MindNode {
  return mapNode(root, nodeId, (node) => ({
    ...node,
    title: title.trim() || "Untitled",
  }));
}

export function updateNodeNote(root: MindNode, nodeId: string, note: string): MindNode {
  return mapNode(root, nodeId, (node) => ({
    ...node,
    note,
  }));
}

export function updateNodeSize(root: MindNode, nodeId: string, size: NonNullable<MindNode["size"]>): MindNode {
  return mapNode(root, nodeId, (node) => ({
    ...node,
    size: {
      width: Math.round(size.width),
      height: Math.round(size.height),
    },
  }));
}

export function deleteNode(root: MindNode, nodeId: string): MindNode {
  if (root.id === nodeId) {
    return root;
  }

  function removeFrom(node: MindNode): MindNode {
    return {
      ...node,
      children: node.children
        .filter((child) => child.id !== nodeId)
        .map((child) => removeFrom(child)),
    };
  }

  return removeFrom(root);
}

export function deleteNodes(root: MindNode, nodeIds: string[]): MindNode {
  const targets = new Set(nodeIds.filter((nodeId) => nodeId !== root.id));
  if (!targets.size) {
    return root;
  }

  function removeFrom(node: MindNode): MindNode {
    return {
      ...node,
      children: node.children
        .filter((child) => !targets.has(child.id))
        .map((child) => removeFrom(child)),
    };
  }

  return removeFrom(root);
}

export function moveSubtree(root: MindNode, movingId: string, newParentId: string, insertionIndex = Number.MAX_SAFE_INTEGER, side?: NodeSide): MindNode {
  if (movingId === root.id || movingId === newParentId) {
    return root;
  }

  const movingNode = findNode(root, movingId);
  const newParent = findNode(root, newParentId);
  if (!movingNode || !newParent || findNode(movingNode, newParentId)) {
    return root;
  }

  const movedSide = newParent.id === root.id ? side ?? movingNode.side ?? "right" : newParent.side;
  const movedNode = relevelSubtree(movingNode, Math.min(newParent.level + 1, 6), movedSide);
  const withoutMovingNode = removeSubtree(root, movingId);
  const movingLocation = findParentLocation(root, movingId);
  const targetIndex = movingLocation?.parentId === newParentId && movingLocation.index < insertionIndex
    ? insertionIndex - 1
    : insertionIndex;

  function insertInto(node: MindNode): MindNode {
    if (node.id === newParentId) {
      const nextChildren = node.children.map((child) => insertInto(child));
      const clampedIndex = Math.max(0, Math.min(targetIndex, nextChildren.length));
      return {
        ...node,
        children: [
          ...nextChildren.slice(0, clampedIndex),
          movedNode,
          ...nextChildren.slice(clampedIndex),
        ],
      };
    }

    return {
      ...node,
      children: node.children.map((child) => insertInto(child)),
    };
  }

  return insertInto(withoutMovingNode);
}

function removeSubtree(root: MindNode, nodeId: string): MindNode {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== nodeId)
      .map((child) => removeSubtree(child, nodeId)),
  };
}

function findParentLocation(root: MindNode, nodeId: string): { parentId: string; index: number } | undefined {
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.id === nodeId) {
      return { parentId: root.id, index };
    }
    const found = findParentLocation(child, nodeId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function relevelSubtree(node: MindNode, level: number, side?: NodeSide): MindNode {
  return {
    ...node,
    level,
    side,
    children: node.children.map((child) => relevelSubtree(child, Math.min(level + 1, 6), side)),
  };
}

export function findNode(root: MindNode, nodeId: string): MindNode | undefined {
  if (root.id === nodeId) {
    return root;
  }
  for (const child of root.children) {
    const found = findNode(child, nodeId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function collectSubtreeIds(root: MindNode, nodeIds: string[]): string[] {
  const ids = new Set<string>();

  function collect(node: MindNode): void {
    ids.add(node.id);
    node.children.forEach(collect);
  }

  nodeIds.forEach((nodeId) => {
    const node = findNode(root, nodeId);
    if (node) {
      collect(node);
    }
  });

  return Array.from(ids);
}
