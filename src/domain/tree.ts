import { createNodeId } from "./ids";
import type { MindNode } from "./types";

type NodeUpdater = (node: MindNode) => MindNode;

function createEmptyNode(level: number, title: string, nodeId = createNodeId("node")): MindNode {
  return {
    id: nodeId,
    title,
    note: "",
    level,
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

export function addChildNode(root: MindNode, parentId: string, title = "New node", nodeId?: string): MindNode {
  return mapNode(root, parentId, (node) => ({
    ...node,
    children: [
      ...node.children,
      createEmptyNode(Math.min(node.level + 1, 6), title, nodeId),
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
        return [nextChild, createEmptyNode(child.level, title, nodeId)];
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

export function moveSubtree(root: MindNode, movingId: string, newParentId: string): MindNode {
  if (movingId === root.id || movingId === newParentId) {
    return root;
  }

  const movingNode = findNode(root, movingId);
  const newParent = findNode(root, newParentId);
  if (!movingNode || !newParent || findNode(movingNode, newParentId)) {
    return root;
  }

  const movedNode = relevelSubtree(movingNode, Math.min(newParent.level + 1, 6));

  function moveFrom(node: MindNode): MindNode {
    if (node.id === newParentId) {
      return {
        ...node,
        children: [
          ...node.children.filter((child) => child.id !== movingId).map((child) => moveFrom(child)),
          movedNode,
        ],
      };
    }

    return {
      ...node,
      children: node.children
        .filter((child) => child.id !== movingId)
        .map((child) => moveFrom(child)),
    };
  }

  return moveFrom(root);
}

function relevelSubtree(node: MindNode, level: number): MindNode {
  return {
    ...node,
    level,
    children: node.children.map((child) => relevelSubtree(child, Math.min(level + 1, 6))),
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
