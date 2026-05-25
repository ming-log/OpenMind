import { createNodeId } from "./ids";
import type { MindNode } from "./types";

type NodeUpdater = (node: MindNode) => MindNode;

function mapNode(node: MindNode, targetId: string, updater: NodeUpdater): MindNode {
  if (node.id === targetId) {
    return updater(node);
  }

  return {
    ...node,
    children: node.children.map((child) => mapNode(child, targetId, updater)),
  };
}

export function addChildNode(root: MindNode, parentId: string, title = "New node"): MindNode {
  return mapNode(root, parentId, (node) => ({
    ...node,
    children: [
      ...node.children,
      {
        id: createNodeId("node"),
        title,
        note: "",
        level: Math.min(node.level + 1, 6),
        children: [],
      },
    ],
  }));
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
