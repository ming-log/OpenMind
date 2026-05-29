import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { calculateCenteredPan, calculateFitScale, calculatePanForZoomAtPoint, findDropIntent, type DropIntent, type DropNodeRect } from "../domain/canvasLayout";
import { calculateNodeHeight, getNodeLayoutHeight, getNodeLayoutWidth, layoutTree, MIN_NODE_HEIGHT, NODE_MAX_HEIGHT, NODE_MAX_WIDTH, NODE_MIN_WIDTH, NODE_WIDTH, TEXT_NODE_MIN_HEIGHT, type PositionedNode } from "../domain/pngExport";
import { getIntersectingNodeIds, normalizeSelectionBox, type SelectableNodeRect, type SelectionBox } from "../domain/selection";
import type { ThemeId, ThemePreset } from "../domain/themes";
import type { GroupFrame, MindNode } from "../domain/types";
import { AddChildNodeIcon, AddParentNodeIcon, AddSiblingNodeIcon, AutoLayoutIcon, FocusIcon, FrameIcon, MinusIcon, NoteDotIcon, TargetIcon, XIcon, ZoomInArrowIcon } from "./Icons";
import { NoteBubble, NoteMarkdownContent } from "./NoteBubble";
import { ThemePicker } from "./ThemePicker";

interface MindMapCanvasProps {
  root: MindNode;
  groupFrames: GroupFrame[];
  selectedId?: string;
  selectedIds: string[];
  themeId: ThemeId;
  themes: readonly ThemePreset[];
  onSelect: (nodeId: string) => void;
  onSelectMany: (nodeIds: string[]) => void;
  onClearSelection: () => void;
  onThemeChange: (themeId: ThemeId) => void;
  onAddChild: (nodeId: string, side?: "left" | "right") => void;
  onAddSibling: (nodeId: string) => void;
  onAddParent: (nodeId: string) => void;
  onEditTitle: (nodeId: string, title: string) => void;
  onEditNote: (nodeId: string, note: string) => void;
  onResizeNode: (nodeId: string, size: NonNullable<MindNode["size"]>) => void;
  onDeleteSelection: (nodeIds: string[]) => void;
  onMoveSubtree: (nodeId: string, newParentId: string, index: number, side?: "left" | "right") => void;
  onCreateGroupFrame: (nodeIds: string[]) => void;
  onUpdateGroupFrameNote: (frameId: string, note: string) => void;
  onDeleteGroupFrame: (frameId: string) => void;
  focusMode: boolean;
  onFocusModeChange: (enabled: boolean) => void;
  shortcutsDisabled?: boolean;
  readOnly?: boolean;
}

const PADDING = 160;
const MIN_SCALE = 0.1;
const MAX_SCALE = 1.8;
const CLICK_DRAG_THRESHOLD = 4;
const NOTE_MARK_GAP = 4;
const NOTE_MARK_WIDTH = 14;
const NOTE_MARK_SPACE = NOTE_MARK_GAP + NOTE_MARK_WIDTH;

type DeleteTarget = {
  nodeIds: string[];
  title: string;
  count: number;
};

type NodeDrag = {
  nodeId: string;
  startX: number;
  startY: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  width: number;
  height: number;
};

type TitleEditor = {
  nodeId: string;
  value: string;
};

type NoteDrawer = {
  node: MindNode;
  value: string;
  mode: "read" | "edit";
};

type FrameEditor = {
  frameId: string;
  value: string;
};

type FrameLayout = {
  side: "left" | "right";
  style: CSSProperties;
  boxStyle: CSSProperties;
  labelStyle: CSSProperties;
};

type CanvasDrag = {
  x: number;
  y: number;
  panX: number;
  panY: number;
  clearSelectionOnClick: boolean;
};

type NodeResize = {
  nodeId: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  minWidth: number;
  minHeight: number;
  directionX: -1 | 0 | 1;
  directionY: -1 | 0 | 1;
};

type NodeResizeDraft = {
  nodeId: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

const RESIZE_HANDLES: Array<{
  name: string;
  directionX: -1 | 0 | 1;
  directionY: -1 | 0 | 1;
}> = [
  { name: "north", directionX: 0, directionY: -1 },
  { name: "east", directionX: 1, directionY: 0 },
  { name: "south", directionX: 0, directionY: 1 },
  { name: "west", directionX: -1, directionY: 0 },
  { name: "north-east", directionX: 1, directionY: -1 },
  { name: "south-east", directionX: 1, directionY: 1 },
  { name: "south-west", directionX: -1, directionY: 1 },
  { name: "north-west", directionX: -1, directionY: -1 },
];

const GROUP_FRAME_PADDING_X = 30;
const GROUP_FRAME_PADDING_TOP = 28;
const GROUP_FRAME_PADDING_BOTTOM = 22;
const GROUP_FRAME_LABEL_GAP = 2;
const GROUP_FRAME_LABEL_CLEARANCE = 12;

function estimateGroupFrameLabelHeight(text: string, labelWidth: number): number {
  const labelVisualLength = Array.from(text).reduce((total, char) => total + (char.charCodeAt(0) > 255 ? 1.7 : 1), 0);
  const labelLines = Math.max(1, Math.ceil(labelVisualLength / Math.max(8, Math.floor(labelWidth / 7))));
  return labelLines * 17 + 14;
}

function estimateGroupFrameTopReserve(note: string): number {
  return GROUP_FRAME_PADDING_TOP + estimateGroupFrameLabelHeight(note.trim() || "备注", 320) + GROUP_FRAME_LABEL_GAP + GROUP_FRAME_LABEL_CLEARANCE;
}

export function MindMapCanvas(props: MindMapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);
  const frameTopReserves = useMemo(() => {
    const parentById = new Map<string, string>();
    const siblingIndexById = new Map<string, number>();
    const topLevelById = new Map<string, string>();

    function walk(node: MindNode, topLevelId: string): void {
      topLevelById.set(node.id, topLevelId);
      node.children.forEach((child, index) => {
        parentById.set(child.id, node.id);
        siblingIndexById.set(child.id, index);
        walk(child, topLevelId);
      });
    }

    props.root.children.forEach((child, index) => {
      parentById.set(child.id, props.root.id);
      siblingIndexById.set(child.id, index);
      walk(child, child.id);
    });

    return props.groupFrames.reduce((reserves, frame) => {
      const frameIds = new Set(frame.nodeIds);
      const getFrameTopReserve = (currentFrame: GroupFrame, visitedFrameIds = new Set<string>()): number => {
        if (visitedFrameIds.has(currentFrame.id)) {
          return 0;
        }
        const nextVisitedFrameIds = new Set(visitedFrameIds);
        nextVisitedFrameIds.add(currentFrame.id);
        const currentFrameNodeIds = new Set(currentFrame.nodeIds);
        const nestedReserve = props.groupFrames.reduce((maximumReserve, childFrame) => {
          if (childFrame.id === currentFrame.id) {
            return maximumReserve;
          }
          const childIsInsideFrame = childFrame.nodeIds.length < currentFrame.nodeIds.length
            && childFrame.nodeIds.every((nodeId) => currentFrameNodeIds.has(nodeId));
          return childIsInsideFrame
            ? Math.max(maximumReserve, getFrameTopReserve(childFrame, nextVisitedFrameIds))
            : maximumReserve;
        }, 0);
        return estimateGroupFrameTopReserve(currentFrame.note) + nestedReserve;
      };
      const reserve = getFrameTopReserve(frame);
      const reserveRootsByParent = new Map<string, string>();

      frame.nodeIds.forEach((nodeId) => {
        const parentId = parentById.get(nodeId);
        if (parentId && frameIds.has(parentId)) {
          return;
        }
        const parentKey = parentId ?? props.root.id;
        const currentRootId = reserveRootsByParent.get(parentKey);
        if (!currentRootId || (siblingIndexById.get(nodeId) ?? 0) < (siblingIndexById.get(currentRootId) ?? 0)) {
          reserveRootsByParent.set(parentKey, nodeId);
        }
      });

      reserveRootsByParent.forEach((nodeId) => {
        reserves.set(nodeId, Math.max(reserves.get(nodeId) ?? 0, reserve));
        const topLevelId = topLevelById.get(nodeId);
        if (topLevelId && topLevelId !== nodeId) {
          reserves.set(topLevelId, Math.max(reserves.get(topLevelId) ?? 0, reserve));
        }
      });
      return reserves;
    }, new Map<string, number>());
  }, [props.groupFrames, props.root]);
  const nodes = useMemo(() => layoutTree(props.root, { topReserves: frameTopReserves }), [frameTopReserves, props.root]);
  const byId = useMemo(() => new Map(nodes.map((entry) => [entry.node.id, entry])), [nodes]);
  const nodeRelations = useMemo(() => {
    const relations = new Map<string, { parentId: string; index: number }>();

    function walk(node: MindNode, parentId: string, index: number): void {
      relations.set(node.id, { parentId, index });
      node.children.forEach((child, childIndex) => walk(child, node.id, childIndex));
    }

    walk(props.root, props.root.id, 0);
    return relations;
  }, [props.root]);
  const nodeDepths = useMemo(() => {
    const depths = new Map<string, number>();

    function walk(node: MindNode, depth: number): void {
      depths.set(node.id, depth);
      node.children.forEach((child) => walk(child, depth + 1));
    }

    walk(props.root, 0);
    return depths;
  }, [props.root]);
  const branchIndexById = useMemo(() => {
    const branchIndex = new Map<string, number>();

    function walk(node: MindNode, index: number): void {
      branchIndex.set(node.id, index);
      node.children.forEach((child) => walk(child, index));
    }

    props.root.children.forEach((child, index) => walk(child, index));
    return branchIndex;
  }, [props.root]);
  const branchPalettes = useMemo(() => {
    const theme = props.themes.find((entry) => entry.id === props.themeId) ?? props.themes[0];
    return theme?.branches ?? [];
  }, [props.themeId, props.themes]);
  const selectedSet = useMemo(() => new Set(props.selectedIds), [props.selectedIds]);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  const [dragStart, setDragStart] = useState<CanvasDrag | null>(null);
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null);
  const [nodeResize, setNodeResize] = useState<NodeResize | null>(null);
  const [resizeDraft, setResizeDraft] = useState<NodeResizeDraft | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isCtrlSelecting, setIsCtrlSelecting] = useState(false);
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const [menu, setMenu] = useState<{ node: MindNode; x: number; y: number } | null>(null);
  const [pinnedNoteId, setPinnedNoteId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [titleEditor, setTitleEditor] = useState<TitleEditor | null>(null);
  const [noteDrawer, setNoteDrawer] = useState<NoteDrawer | null>(null);
  const [frameEditor, setFrameEditor] = useState<FrameEditor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [activeDropIntent, setActiveDropIntent] = useState<DropIntent | undefined>();
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const frameInputRef = useRef<HTMLTextAreaElement>(null);

  const width = Math.max(...nodes.map((entry) => entry.x + getRenderedNodeWidth(entry))) + PADDING * 2;
  const height = Math.max(...nodes.map((entry) => entry.y + getRenderedNodeHeight(entry))) + PADDING * 2;
  const draggedIds = useMemo(() => {
    if (!nodeDrag) {
      return new Set<string>();
    }

    const draggedNode = byId.get(nodeDrag.nodeId)?.node;
    const ids = new Set<string>();
    if (!draggedNode) {
      return ids;
    }

    function collect(node: MindNode): void {
      ids.add(node.id);
      node.children.forEach(collect);
    }

    collect(draggedNode);
    return ids;
  }, [byId, nodeDrag]);
  useEffect(() => {
    if (!noteDrawer || noteDrawer.mode !== "edit") return;
    noteInputRef.current?.focus();
  }, [noteDrawer]);

  useEffect(() => {
    if (!titleEditor) return;
    const input = titleInputRef.current;
    if (!input) return;
    resizeTitleInput(input);
  }, [titleEditor?.value]);

  useEffect(() => {
    if (!titleEditor) return;
    const input = titleInputRef.current;
    if (!input) return;
    window.requestAnimationFrame(() => {
      const end = input.value.length;
      input.focus();
      input.setSelectionRange(end, end);
      resizeTitleInput(input);
    });
  }, [titleEditor?.nodeId]);

  useEffect(() => {
    if (!frameEditor) return;
    const input = frameInputRef.current;
    if (!input) return;
    resizeFrameInput(input);
  }, [frameEditor?.value]);

  useEffect(() => {
    if (!frameEditor) return;
    const input = frameInputRef.current;
    if (!input) return;
    window.requestAnimationFrame(() => {
      const end = input.value.length;
      input.focus();
      input.setSelectionRange(end, end);
      resizeFrameInput(input);
    });
  }, [frameEditor?.frameId]);

  useEffect(() => {
    if (!titleEditor) return undefined;

    function pointerdown(event: PointerEvent): void {
      const input = titleInputRef.current;
      if (!input || !(event.target instanceof Node) || input.contains(event.target)) {
        return;
      }
      saveTitleEdit();
    }

    document.addEventListener("pointerdown", pointerdown, { capture: true });
    return () => document.removeEventListener("pointerdown", pointerdown, { capture: true });
  }, [titleEditor]);

  useEffect(() => {
    window.requestAnimationFrame(() => focusNode(props.root.id, 1));
  }, [props.root.id]);

  useEffect(() => {
    return () => resetNodeDragPreview();
  }, []);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    if (!noteDrawer) return undefined;

    function keydown(event: KeyboardEvent): void {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setNoteDrawer(null);
    }

    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [noteDrawer]);

  function startTitleEdit(node: MindNode): void {
    if (props.readOnly) return;
    setTitleEditor({ nodeId: node.id, value: node.title });
    setDeleteTarget(null);
    setMenu(null);
  }

  function saveTitleEdit(): void {
    if (!titleEditor) return;
    if (props.readOnly) {
      setTitleEditor(null);
      return;
    }

    props.onEditTitle(titleEditor.nodeId, titleEditor.value);
    setTitleEditor(null);
  }

  function resizeTitleInput(input: HTMLTextAreaElement): void {
    input.style.height = "0px";
    input.style.height = `${input.scrollHeight}px`;
  }

  function resizeFrameInput(input: HTMLTextAreaElement): void {
    input.style.height = "0px";
    input.style.height = `${input.scrollHeight}px`;
  }

  function saveFrameEdit(): void {
    if (!frameEditor) return;
    if (!props.readOnly) {
      props.onUpdateGroupFrameNote(frameEditor.frameId, frameEditor.value);
    }
    setFrameEditor(null);
  }

  function insertTitleLineBreak(input: HTMLTextAreaElement): void {
    if (!titleEditor) return;

    const start = input.selectionStart ?? titleEditor.value.length;
    const end = input.selectionEnd ?? start;
    const nextValue = `${titleEditor.value.slice(0, start)}\n${titleEditor.value.slice(end)}`;
    setTitleEditor({ ...titleEditor, value: nextValue });
    window.requestAnimationFrame(() => {
      input.selectionStart = start + 1;
      input.selectionEnd = start + 1;
      resizeTitleInput(input);
    });
  }

  function openNoteDrawer(node: MindNode): void {
    setNoteDrawer({ node, value: node.note, mode: "read" });
    setDeleteTarget(null);
    setMenu(null);
  }

  function syncOpenNoteDrawer(node: MindNode): void {
    setNoteDrawer((current) => current
      ? { node, value: node.note, mode: props.readOnly ? "read" : current.mode }
      : current);
  }

  function saveNoteDrawer(): void {
    if (!noteDrawer) return;
    if (props.readOnly) {
      setNoteDrawer(null);
      return;
    }

    props.onEditNote(noteDrawer.node.id, noteDrawer.value);
    setNoteDrawer(null);
  }

  function requestDelete(nodeIds: string[]): void {
    if (props.readOnly) return;
    const removableIds = Array.from(new Set(nodeIds)).filter((nodeId) => nodeId !== props.root.id);
    if (!removableIds.length) {
      props.onDeleteSelection(nodeIds);
      setMenu(null);
      return;
    }
    const firstNode = byId.get(removableIds[0])?.node;

    setDeleteTarget({
      nodeIds: removableIds,
      title: removableIds.length === 1 ? firstNode?.title ?? "节点" : `${removableIds.length} 个节点`,
      count: removableIds.length,
    });
    setTitleEditor(null);
    setNoteDrawer(null);
    setMenu(null);
  }

  function confirmDelete(): void {
    if (!deleteTarget) return;

    props.onDeleteSelection(deleteTarget.nodeIds);
    setDeleteTarget(null);
  }

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
  }

  function isCanvasSurfaceTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    return !target.closest(
      ".mind-node, .canvas-controls, .theme-dock, .note-drawer, .context-menu, .node-dialog, button, input, textarea, select",
    );
  }

  function startCanvasDrag(event: React.MouseEvent, clearSelectionOnClick: boolean): void {
    event.preventDefault();
    setMenu(null);
    setDragStart({
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
      clearSelectionOnClick,
    });
  }

  function isClickDistance(drag: CanvasDrag, event: React.MouseEvent): boolean {
    return Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <= CLICK_DRAG_THRESHOLD;
  }

  function getViewportPoint(event: React.MouseEvent): { x: number; y: number } {
    return getViewportPointFromClient(event.clientX, event.clientY);
  }

  function getViewportPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  }

  function getSelectableNodeRects(): SelectableNodeRect[] {
    return nodes.map((entry) => ({
      id: entry.node.id,
      left: pan.x + getRenderedNodeLeft(entry) * scale,
      top: pan.y + getRenderedNodeTop(entry) * scale,
      width: getRenderedNodeWidth(entry) * scale,
      height: getRenderedNodeHeight(entry) * scale,
    }));
  }

  function clearSuppressedClickSoon(): void {
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function centerMap(nextScale = scale): void {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const nextPan = calculateCenteredPan({
      viewportWidth: rect.width,
      viewportHeight: rect.height,
      contentWidth: width,
      contentHeight: height,
      scale: nextScale,
    });
    panRef.current = nextPan;
    setPan(nextPan);
  }

  function clampScale(value: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  }

  function commitViewport(nextPan: { x: number; y: number }, nextScale: number): void {
    panRef.current = nextPan;
    scaleRef.current = nextScale;
    setPan(nextPan);
    setScale(nextScale);
  }

  function zoomAtViewportPoint(point: { x: number; y: number }, getNextScale: (currentScale: number) => number): void {
    const currentScale = scaleRef.current;
    const nextScale = clampScale(getNextScale(currentScale));
    if (nextScale === currentScale) {
      return;
    }

    const nextPan = calculatePanForZoomAtPoint({
      pan: panRef.current,
      point,
      currentScale,
      nextScale,
    });
    commitViewport(nextPan, nextScale);
  }

  function zoomAtViewportCenter(getNextScale: (currentScale: number) => number): void {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      setScale((currentScale) => {
        const nextScale = clampScale(getNextScale(currentScale));
        scaleRef.current = nextScale;
        return nextScale;
      });
      return;
    }

    zoomAtViewportPoint({ x: rect.width / 2, y: rect.height / 2 }, getNextScale);
  }

  function getDropNodeRects(): DropNodeRect[] {
    return nodes.map((entry) => {
      const relation = nodeRelations.get(entry.node.id) ?? { parentId: props.root.id, index: 0 };
      return {
        id: entry.node.id,
        parentId: relation.parentId,
        index: relation.index,
        side: entry.node.side,
        left: pan.x + getRenderedNodeLeft(entry) * scale,
        top: pan.y + getRenderedNodeTop(entry) * scale,
        width: getRenderedNodeWidth(entry) * scale,
        height: getRenderedNodeHeight(entry) * scale,
      };
    });
  }

  function sameDropIntent(left: DropIntent | undefined, right: DropIntent | undefined): boolean {
    return left?.parentId === right?.parentId
      && left?.index === right?.index
      && left?.placement === right?.placement
      && left?.targetId === right?.targetId
      && left?.side === right?.side;
  }

  function resetNodeDragPreview(): void {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    dragOffsetRef.current = { x: 0, y: 0 };
    if (dragPreviewRef.current) {
      dragPreviewRef.current.style.transform = "";
    }
  }

  function scheduleNodeDragPreview(drag: NodeDrag, clientX: number, clientY: number): void {
    dragOffsetRef.current = {
      x: (clientX - drag.startX) / scale,
      y: (clientY - drag.startY) / scale,
    };

    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const offset = dragOffsetRef.current;
      if (dragPreviewRef.current) {
        dragPreviewRef.current.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
      }

      const intent = findDropIntent(
        getDragIntentPoint(drag, drag.startX + offset.x * scale, drag.startY + offset.y * scale),
        getDropNodeRects(),
        draggedIds,
      );
      setActiveDropIntent((current) => (sameDropIntent(current, intent) ? current : intent));
    });
  }

  function finishNodeDrag(drag: NodeDrag, clientX: number, clientY: number, excludedIds: Set<string>): void {
    const intent = findDropIntent(getDragIntentPoint(drag, clientX, clientY), getDropNodeRects(), excludedIds);
    resetNodeDragPreview();
    setActiveDropIntent(undefined);
    if (intent) {
      props.onMoveSubtree(drag.nodeId, intent.parentId, intent.index, intent.side);
    }
    setNodeDrag(null);
  }

  function getDragIntentPoint(drag: NodeDrag, clientX: number, clientY: number): { x: number; y: number } {
    return getViewportPointFromClient(
      clientX - drag.pointerOffsetX + drag.width / 2,
      clientY - drag.pointerOffsetY + drag.height / 2,
    );
  }

  function normalizeWheelDeltaY(event: WheelEvent, viewport: HTMLElement): number {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return event.deltaY * 16;
    }
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return event.deltaY * viewport.clientHeight;
    }
    return event.deltaY;
  }

  function panViewportVertically(deltaY: number): void {
    const nextPan = {
      ...panRef.current,
      y: panRef.current.y - deltaY,
    };
    panRef.current = nextPan;
    setPan(nextPan);
  }

  function getEventElement(target: EventTarget | null): Element | null {
    if (target instanceof Element) {
      return target;
    }
    return target instanceof Node ? target.parentElement : null;
  }

  function isNoteScrollTarget(target: EventTarget | null): boolean {
    return Boolean(getEventElement(target)?.closest(".note-bubble, .note-drawer-content"));
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const wheelViewport = viewport;

    function wheel(event: WheelEvent): void {
      if (!(event.target instanceof Node) || !wheelViewport.contains(event.target)) {
        return;
      }
      const plainWheel = !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
      if (plainWheel && isNoteScrollTarget(event.target)) {
        return;
      }
      if (!plainWheel && !event.ctrlKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (plainWheel) {
        panViewportVertically(normalizeWheelDeltaY(event, wheelViewport));
        return;
      }
      const rect = wheelViewport.getBoundingClientRect();
      zoomAtViewportPoint(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        (value) => value - event.deltaY * 0.001,
      );
    }

    document.addEventListener("wheel", wheel, { capture: true, passive: false });
    return () => document.removeEventListener("wheel", wheel, { capture: true });
  }, []);

  function clampSize(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function calculateResizeDraft(resize: NodeResize, clientX: number, clientY: number): NodeResizeDraft {
    const deltaX = (clientX - resize.startX) / scaleRef.current;
    const deltaY = (clientY - resize.startY) / scaleRef.current;
    const width = clampSize(resize.startWidth + deltaX * resize.directionX, resize.minWidth, NODE_MAX_WIDTH);
    const height = clampSize(resize.startHeight + deltaY * resize.directionY, resize.minHeight, NODE_MAX_HEIGHT);
    return {
      nodeId: resize.nodeId,
      width,
      height,
      offsetX: resize.directionX === -1 ? resize.startWidth - width : 0,
      offsetY: resize.directionY === -1 ? resize.startHeight - height : 0,
    };
  }

  function startNodeResize(
    event: React.MouseEvent,
    entry: PositionedNode,
    directionX: NodeResize["directionX"],
    directionY: NodeResize["directionY"],
  ): void {
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    setMenu(null);
    setPinnedNoteId(null);
    props.onSelect(entry.node.id);

    const startWidth = getRenderedNodeWidth(entry);
    const startHeight = getRenderedNodeHeight(entry);
    const resize = {
      nodeId: entry.node.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth,
      startHeight,
      minWidth: getRenderedNodeMinWidth(entry),
      minHeight: getRenderedNodeMinHeight(entry),
      directionX,
      directionY,
    };
    setNodeResize(resize);
    setResizeDraft({ nodeId: entry.node.id, width: startWidth, height: startHeight, offsetX: 0, offsetY: 0 });
  }

  useEffect(() => {
    if (!nodeResize) {
      return;
    }
    const activeResize = nodeResize;

    function mousemove(event: MouseEvent): void {
      event.preventDefault();
      suppressClickRef.current = true;
      setResizeDraft(calculateResizeDraft(activeResize, event.clientX, event.clientY));
    }

    function mouseup(event: MouseEvent): void {
      event.preventDefault();
      suppressClickRef.current = true;
      const nextDraft = calculateResizeDraft(activeResize, event.clientX, event.clientY);
      props.onResizeNode(activeResize.nodeId, {
        width: nextDraft.width,
        height: nextDraft.height,
      });
      setResizeDraft(null);
      setNodeResize(null);
      clearSuppressedClickSoon();
    }

    window.addEventListener("mousemove", mousemove);
    window.addEventListener("mouseup", mouseup);
    return () => {
      window.removeEventListener("mousemove", mousemove);
      window.removeEventListener("mouseup", mouseup);
    };
  }, [nodeResize]);

  useEffect(() => {
    if (!nodeDrag) {
      return;
    }
    const activeDrag = nodeDrag;

    function mousemove(event: MouseEvent): void {
      suppressClickRef.current = true;
      scheduleNodeDragPreview(activeDrag, event.clientX, event.clientY);
    }

    function mouseup(event: MouseEvent): void {
      suppressClickRef.current = true;
      finishNodeDrag(activeDrag, event.clientX, event.clientY, draggedIds);
    }

    window.addEventListener("mousemove", mousemove);
    window.addEventListener("mouseup", mouseup);
    return () => {
      window.removeEventListener("mousemove", mousemove);
      window.removeEventListener("mouseup", mouseup);
    };
  }, [draggedIds, nodeDrag]);

  useEffect(() => {
    function keydown(event: KeyboardEvent): void {
      if (props.shortcutsDisabled || props.readOnly) {
        return;
      }

      const overlayOpen = titleEditor || noteDrawer || deleteTarget || menu || frameEditor || nodeResize;
      if (overlayOpen) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "Control") {
        setIsCtrlSelecting(true);
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setIsSpacePanning(true);
        return;
      }
      if (event.repeat) {
        return;
      }

      if (event.key === "Delete" && selectedFrameId) {
        event.preventDefault();
        setMenu(null);
        props.onDeleteGroupFrame(selectedFrameId);
        setSelectedFrameId(null);
        return;
      }

      const selectedId = props.selectedId ?? props.selectedIds[0];
      if (!selectedId) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        setMenu(null);
        props.onAddSibling(selectedId);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        setMenu(null);
        props.onAddChild(selectedId);
        return;
      }
      if (event.key === "Delete") {
        event.preventDefault();
        setMenu(null);
        requestDelete(props.selectedIds.length ? props.selectedIds : [selectedId]);
        return;
      }
      if (event.key === "`" || event.code === "Backquote") {
        event.preventDefault();
        const selected = byId.get(selectedId);
        if (selected) {
          openNoteDrawer(selected.node);
        }
      }
    }

    function keyup(event: KeyboardEvent): void {
      if (event.key === "Control") {
        setIsCtrlSelecting(false);
      }
      if (event.code === "Space") {
        setIsSpacePanning(false);
      }
    }

    function blur(): void {
      setIsCtrlSelecting(false);
      setIsSpacePanning(false);
      setDragStart(null);
      if (nodeDrag) {
        resetNodeDragPreview();
        setActiveDropIntent(undefined);
        setNodeDrag(null);
      }
      setNodeResize(null);
      setResizeDraft(null);
      setSelectionBox(null);
    }

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }, [byId, deleteTarget, frameEditor, menu, nodeDrag, nodeResize, noteDrawer, props, selectedFrameId, titleEditor]);

  const normalizedSelection = selectionBox ? normalizeSelectionBox(selectionBox) : null;
  const draggedEntry = nodeDrag ? byId.get(nodeDrag.nodeId) : undefined;

  function getDropPreviewStyle(intent: DropIntent): CSSProperties | undefined {
    const target = byId.get(intent.targetId);
    if (!target) {
      return undefined;
    }

    if (intent.placement === "inside") {
        const leftSide = intent.side === "left";
      return {
        left: getRenderedNodeLeft(target) + (leftSide ? -100 : getRenderedNodeWidth(target) + 26),
        top: getRenderedNodeTop(target) + getRenderedNodeHeight(target) / 2 - 2,
        width: 74,
      };
    }

    return {
      left: getRenderedNodeLeft(target) - 8,
      top: getRenderedNodeTop(target) + (intent.placement === "before" ? -8 : getRenderedNodeHeight(target) + 6),
      width: getRenderedNodeWidth(target) + 16,
    };
  }

  function fitAndCenterMap(): void {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const nextScale = calculateFitScale({
      viewportWidth: rect.width,
      viewportHeight: rect.height,
      contentWidth: width,
      contentHeight: height,
      scale,
      minScale: MIN_SCALE,
      maxScale: MAX_SCALE,
      margin: 40,
    });
    const nextPan = calculateCenteredPan({
      viewportWidth: rect.width,
      viewportHeight: rect.height,
      contentWidth: width,
      contentHeight: height,
      scale: nextScale,
    });
    commitViewport(nextPan, nextScale);
  }

  function focusNode(nodeId: string, nextScale = scale): void {
    const selected = byId.get(nodeId);
    if (!selected) {
      return;
    }
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const targetX = rect.width / 2 - (getRenderedNodeWidth(selected) * nextScale) / 2;
    const targetY = rect.height / 2 - (getRenderedNodeHeight(selected) * nextScale) / 2;
    commitViewport({
      x: targetX - getRenderedNodeLeft(selected) * nextScale,
      y: targetY - getRenderedNodeTop(selected) * nextScale,
    }, nextScale);
  }

  function getFrameLayout(frame: GroupFrame, visitedFrameIds = new Set<string>()): FrameLayout | undefined {
    if (visitedFrameIds.has(frame.id)) {
      return undefined;
    }
    const nextVisitedFrameIds = new Set(visitedFrameIds);
    nextVisitedFrameIds.add(frame.id);
    const entries = frame.nodeIds
      .map((nodeId) => byId.get(nodeId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    if (!entries.length) {
      return undefined;
    }

    let left = Math.min(...entries.map((entry) => getRenderedNodeLeft(entry)));
    let top = Math.min(...entries.map((entry) => getRenderedNodeTop(entry)));
    let right = Math.max(...entries.map((entry) => getRenderedNodeLeft(entry) + getRenderedNodeWidth(entry)));
    let bottom = Math.max(...entries.map((entry) => getRenderedNodeTop(entry) + getRenderedNodeHeight(entry)));
    const frameNodeIds = new Set(frame.nodeIds);
    props.groupFrames.forEach((childFrame) => {
      if (childFrame.id === frame.id) {
        return;
      }
      const childNodeIds = new Set(childFrame.nodeIds);
      const childIsInsideFrame = childNodeIds.size < frameNodeIds.size
        && childFrame.nodeIds.every((nodeId) => frameNodeIds.has(nodeId));
      if (!childIsInsideFrame) {
        return;
      }
      const childLayout = getFrameLayout(childFrame, nextVisitedFrameIds);
      if (!childLayout) {
        return;
      }
      const childLeft = Number(childLayout.style.left);
      const childTop = Number(childLayout.style.top);
      const childWidth = Number(childLayout.style.width);
      const childHeight = Number(childLayout.style.height);
      left = Math.min(left, childLeft);
      top = Math.min(top, childTop);
      right = Math.max(right, childLeft + childWidth);
      bottom = Math.max(bottom, childTop + childHeight);
    });
    const rootEntry = byId.get(props.root.id);
    const rootCenterX = rootEntry ? getRenderedNodeLeft(rootEntry) + getRenderedNodeWidth(rootEntry) / 2 : (left + right) / 2;
    const side = (left + right) / 2 < rootCenterX ? "left" : "right";
    const paddingX = GROUP_FRAME_PADDING_X;
    const paddingTop = GROUP_FRAME_PADDING_TOP;
    const paddingBottom = GROUP_FRAME_PADDING_BOTTOM;
    const frameWidth = right - left + paddingX * 2;
    const labelWidth = frameWidth * 0.9;
    const editedFrameNote = frameEditor?.frameId === frame.id ? frameEditor.value : frame.note;
    const labelText = editedFrameNote.trim() || "备注";
    const labelHeight = estimateGroupFrameLabelHeight(labelText, labelWidth);
    const labelGap = GROUP_FRAME_LABEL_GAP;
    const boxTop = labelHeight + labelGap;
    const boxHeight = bottom - top + paddingTop + paddingBottom;
    const frameTop = top - paddingTop - boxTop;

    return {
      side,
      style: {
        left: left - paddingX,
        top: frameTop,
        width: frameWidth,
        height: boxTop + boxHeight,
      },
      boxStyle: {
        top: boxTop,
        height: boxHeight,
      },
      labelStyle: {
        width: labelWidth,
      },
    };
  }

  function getBranchSide(entry: PositionedNode): "root" | "left" | "right" {
    if (entry.node.id === props.root.id) {
      return "root";
    }
    const rootEntry = byId.get(props.root.id);
    if (!rootEntry) {
      return "right";
    }
    return entry.x < rootEntry.x ? "left" : "right";
  }

  function getNodeDepth(entry: PositionedNode): number {
    return nodeDepths.get(entry.node.id) ?? Math.max(entry.node.level - 1, 0);
  }

  function getBranchPalette(nodeId: string) {
    if (!branchPalettes.length) {
      return undefined;
    }
    const branchIndex = branchIndexById.get(nodeId);
    if (branchIndex === undefined) {
      return undefined;
    }
    return branchPalettes[branchIndex % branchPalettes.length];
  }

  function getNodeBranchStyle(entry: PositionedNode): CSSProperties {
    if (entry.node.id === props.root.id) {
      return {};
    }
    const palette = getBranchPalette(entry.node.id);
    if (!palette) {
      return {};
    }
    const side = getBranchSide(entry);
    const sideKey = side === "left" ? "left" : "right";
    return {
      [`--node-${sideKey}-bg`]: palette.node.bg,
      [`--node-${sideKey}-border`]: palette.node.border,
      [`--node-${sideKey}-text`]: palette.node.text,
      [`--node-bg`]: palette.node.bg,
      [`--node-border`]: palette.node.border,
      [`--node-text`]: palette.node.text,
      [`--edge-${sideKey}`]: palette.edge,
      [`--edge`]: palette.edge,
    } as CSSProperties;
  }

  function getEdgeBranchColor(childEntry: PositionedNode): string | undefined {
    return getBranchPalette(childEntry.node.id)?.edge;
  }

  function getRenderedNodeHeight(entry: PositionedNode): number {
    if (resizeDraft?.nodeId === entry.node.id) {
      return resizeDraft.height;
    }
    if (entry.node.size?.height) {
      return getNodeLayoutHeight(entry.node, getNodeDepth(entry));
    }
    if (titleEditor?.nodeId !== entry.node.id) {
      return entry.height;
    }
    return calculateNodeHeight({ ...entry.node, title: titleEditor.value }, getNodeDepth(entry));
  }

  function getRenderedNodeMinHeight(entry: PositionedNode): number {
    return getNodeDepth(entry) > 1 ? TEXT_NODE_MIN_HEIGHT : MIN_NODE_HEIGHT;
  }

  function getRenderedNodeMinWidth(entry: PositionedNode): number {
    return getNodeDepth(entry) > 1
      ? Math.max(36, entry.node.note.trim() ? NOTE_MARK_SPACE + 18 : 36)
      : NODE_MIN_WIDTH;
  }

  function getRenderedNodeWidth(entry: PositionedNode): number {
    if (resizeDraft?.nodeId === entry.node.id) {
      return resizeDraft.width;
    }
    if (entry.node.size?.width) {
      return getNodeLayoutWidth(entry.node, getNodeDepth(entry));
    }

    if (titleEditor?.nodeId === entry.node.id) {
      return getNodeLayoutWidth({ ...entry.node, title: titleEditor.value }, getNodeDepth(entry));
    }

    return getNodeLayoutWidth(entry.node, getNodeDepth(entry));
  }

  function getRenderedNodeLeft(entry: PositionedNode): number {
    return PADDING + entry.x + (resizeDraft?.nodeId === entry.node.id ? resizeDraft.offsetX : 0);
  }

  function getRenderedNodeTop(entry: PositionedNode): number {
    return PADDING + entry.y + (resizeDraft?.nodeId === entry.node.id ? resizeDraft.offsetY : 0);
  }

  function getConnectorX(entry: PositionedNode, side: "left" | "right"): number {
    const left = getRenderedNodeLeft(entry);
    return side === "left" ? left : left + getRenderedNodeWidth(entry);
  }

  const primarySelectedId = props.selectedIds.length === 1 ? props.selectedIds[0] : props.selectedId;
  const primarySelectedEntry = primarySelectedId ? byId.get(primarySelectedId) : undefined;
  const canUseNodeTools = Boolean(primarySelectedEntry) && props.selectedIds.length <= 1;
  const canAddSibling = canUseNodeTools && primarySelectedId !== props.root.id;
  const canAddParent = canUseNodeTools && primarySelectedId !== props.root.id;
  const selectedFrameNodeIds = useMemo(() => {
    const ids = new Set<string>();

    function collect(node: MindNode): void {
      ids.add(node.id);
      node.children.forEach(collect);
    }

    props.selectedIds.forEach((nodeId) => {
      const entry = byId.get(nodeId);
      if (entry) {
        collect(entry.node);
      }
    });

    return [...ids].sort();
  }, [byId, props.selectedIds]);
  const selectedHasGroupFrame = useMemo(() => {
    if (!selectedFrameNodeIds.length) {
      return false;
    }

    return props.groupFrames.some((frame) => {
      const frameIds = [...frame.nodeIds].sort();
      return frameIds.length === selectedFrameNodeIds.length
        && frameIds.every((nodeId, index) => nodeId === selectedFrameNodeIds[index]);
    });
  }, [props.groupFrames, selectedFrameNodeIds]);

  function addSelectedChild(): void {
    if (!primarySelectedId || !canUseNodeTools) return;
    props.onAddChild(primarySelectedId);
  }

  function addSelectedSibling(): void {
    if (!primarySelectedId || !canAddSibling) return;
    props.onAddSibling(primarySelectedId);
  }

  function addSelectedParent(): void {
    if (!primarySelectedId || !canAddParent) return;
    props.onAddParent(primarySelectedId);
  }

  return (
    <section
      className={`map-shell ${isSpacePanning ? "space-panning" : ""} ${isCtrlSelecting ? "ctrl-selecting" : ""}`}
      onMouseMove={(event) => {
        if (selectionBox) {
          const point = getViewportPoint(event);
          setSelectionBox({ ...selectionBox, endX: point.x, endY: point.y });
          return;
        }
        if (dragStart) {
          if (!isClickDistance(dragStart, event)) {
            suppressClickRef.current = true;
          }
          const nextPan = {
            x: dragStart.panX + event.clientX - dragStart.x,
            y: dragStart.panY + event.clientY - dragStart.y,
          };
          panRef.current = nextPan;
          setPan(nextPan);
        }
      }}
      onMouseUp={(event) => {
        if (selectionBox) {
          const point = getViewportPoint(event);
          const finalSelection = { ...selectionBox, endX: point.x, endY: point.y };
          const selected = getIntersectingNodeIds(finalSelection, getSelectableNodeRects());
          if (selected.length) {
            props.onSelectMany(selected);
            setSelectedFrameId(null);
          }
          setSelectionBox(null);
        }
        if (dragStart?.clearSelectionOnClick && isClickDistance(dragStart, event)) {
          props.onClearSelection();
          setSelectedFrameId(null);
          setPinnedNoteId(null);
          setMenu(null);
        }
        setDragStart(null);
        if (suppressClickRef.current) {
          clearSuppressedClickSoon();
        }
      }}
      onMouseLeave={() => {
        setDragStart(null);
        setSelectionBox(null);
        suppressClickRef.current = false;
      }}
    >
      {!props.readOnly ? <ThemePicker themeId={props.themeId} themes={props.themes} onThemeChange={props.onThemeChange} /> : null}
      <div className="canvas-controls">
        <button onClick={() => zoomAtViewportCenter((value) => value - 0.1)} title="缩小" type="button"><MinusIcon /></button>
        <span className="canvas-zoom-value">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomAtViewportCenter((value) => value + 0.1)} title="放大" type="button"><ZoomInArrowIcon /></button>
        {!props.readOnly ? (
          <>
            <span className="canvas-control-separator" aria-hidden="true" />
            <button
              className={canUseNodeTools ? "active" : ""}
              disabled={!canUseNodeTools}
              onClick={addSelectedChild}
              title="增加下级节点"
              type="button"
            >
              <AddChildNodeIcon />
            </button>
            <button
              className={canAddSibling ? "active" : ""}
              disabled={!canAddSibling}
              onClick={addSelectedSibling}
              title="增加同级节点"
              type="button"
            >
              <AddSiblingNodeIcon />
            </button>
            <button
              className={canAddParent ? "active" : ""}
              disabled={!canAddParent}
              onClick={addSelectedParent}
              title="增加上级节点"
              type="button"
            >
              <AddParentNodeIcon />
            </button>
          </>
        ) : null}
        <span className="canvas-control-separator" aria-hidden="true" />
        <button
          onClick={() => {
            fitAndCenterMap();
          }}
          title="自动排版并居中"
          type="button"
        >
          <AutoLayoutIcon />
        </button>
          <button
          onClick={() => {
            const selected = props.selectedId ? byId.get(props.selectedId) : byId.get(props.root.id);
            if (selected) {
              const nextScale = Math.max(scale, 1);
              focusNode(selected.node.id, nextScale);
            }
          }}
          title="聚焦选中节点"
          type="button"
        >
          <TargetIcon />
        </button>
        {!props.readOnly && props.selectedIds.length ? (
          <button
            className={selectedHasGroupFrame ? "active" : ""}
            onClick={() => props.onCreateGroupFrame(props.selectedIds)}
            title={selectedHasGroupFrame ? "取消选中节点外框" : "为选中节点添加外框"}
            type="button"
          >
            <FrameIcon />
          </button>
        ) : null}
        {!props.readOnly ? (
          <button
            className={props.focusMode ? "active" : ""}
            onClick={() => props.onFocusModeChange(!props.focusMode)}
            title={props.focusMode ? "退出专注模式" : "进入专注模式"}
            type="button"
          >
            <FocusIcon />
          </button>
        ) : null}
      </div>
      <div
        ref={viewportRef}
        className={`map-viewport ${dragStart || isSpacePanning ? "panning" : ""} ${isCtrlSelecting ? "selecting" : ""}`}
        onMouseDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          if (event.ctrlKey || isCtrlSelecting) {
            event.preventDefault();
            setMenu(null);
            const point = getViewportPoint(event);
            suppressClickRef.current = true;
            setSelectionBox({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
            return;
          }
          if (isSpacePanning) {
            suppressClickRef.current = true;
            startCanvasDrag(event, false);
            return;
          }
          if (isCanvasSurfaceTarget(event.target)) {
            startCanvasDrag(event, true);
          }
        }}
      >
        {normalizedSelection ? (
          <div
            className="selection-box"
            style={{
              left: normalizedSelection.left,
              top: normalizedSelection.top,
              width: normalizedSelection.right - normalizedSelection.left,
              height: normalizedSelection.bottom - normalizedSelection.top,
            }}
          />
        ) : null}
        <div
          className="map-stage"
          style={{
            width,
            height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          <svg className="edge-layer" width={width} height={height}>
            {nodes.flatMap((entry) =>
              entry.node.children.map((child) => {
                const childEntry = byId.get(child.id);
                if (!childEntry) return null;
                const childIsLeft = childEntry.x < entry.x;
                const startX = getConnectorX(entry, childIsLeft ? "left" : "right");
                const startY = getRenderedNodeTop(entry) + getRenderedNodeHeight(entry) / 2;
                const endX = getConnectorX(childEntry, childIsLeft ? "right" : "left");
                const endY = getRenderedNodeTop(childEntry) + getRenderedNodeHeight(childEntry) / 2;
                const midX = (startX + endX) / 2;
                const isActiveEdge = selectedSet.has(entry.node.id) || selectedSet.has(child.id);
                const branchEdgeColor = getEdgeBranchColor(childEntry);
                return (
                  <path
                    className={isActiveEdge ? "active" : undefined}
                    data-branch-side={getBranchSide(childEntry)}
                    key={`${entry.node.id}-${child.id}`}
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                    style={!isActiveEdge && branchEdgeColor ? { stroke: branchEdgeColor } : undefined}
                  />
                );
              }),
            )}
          </svg>
          {activeDropIntent ? (
            <div
              className={`drop-preview ${activeDropIntent.placement}`}
              style={getDropPreviewStyle(activeDropIntent)}
            />
          ) : null}
          {[...props.groupFrames].sort((first, second) => second.nodeIds.length - first.nodeIds.length).map((frame) => {
            const layout = getFrameLayout(frame);
            if (!layout) return null;
            return (
              <div
                className={`group-frame ${layout.side} ${selectedFrameId === frame.id ? "selected" : ""}`}
                data-frame-side={layout.side}
                key={frame.id}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedFrameId(frame.id);
                  props.onClearSelection();
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                style={layout.style}
              >
                <span className="group-frame-box" aria-hidden="true" style={layout.boxStyle} />
                {frameEditor?.frameId === frame.id ? (
                  <textarea
                    aria-label="编辑外框备注"
                    className="group-frame-note group-frame-note-input"
                    ref={frameInputRef}
                    rows={1}
                    style={layout.labelStyle}
                    value={frameEditor.value}
                    onBlur={saveFrameEdit}
                    onChange={(event) => setFrameEditor({ ...frameEditor, value: event.target.value })}
                    onClick={(event) => event.stopPropagation()}
                    onInput={(event) => resizeFrameInput(event.currentTarget)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        if (event.ctrlKey) {
                          return;
                        }
                        event.preventDefault();
                        saveFrameEdit();
                        return;
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setFrameEditor(null);
                      }
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                  />
                ) : (
                  <button
                    className="group-frame-note"
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedFrameId(frame.id);
                      props.onClearSelection();
                      if (!props.readOnly) {
                        setFrameEditor({ frameId: frame.id, value: frame.note });
                      }
                    }}
                    style={layout.labelStyle}
                    type="button"
                  >
                    {frame.note || "备注"}
                  </button>
                )}
              </div>
            );
          })}
          {draggedEntry ? (
            <article
              aria-hidden="true"
              className={`mind-node drag-preview level-${draggedEntry.node.level}`}
              data-branch-side={getBranchSide(draggedEntry)}
              data-has-note={draggedEntry.node.note.trim() ? "true" : "false"}
              data-node-depth={getNodeDepth(draggedEntry)}
              ref={dragPreviewRef}
              style={{
                left: getRenderedNodeLeft(draggedEntry),
                top: getRenderedNodeTop(draggedEntry),
                width: getRenderedNodeWidth(draggedEntry),
                maxWidth: NODE_MAX_WIDTH,
                height: getRenderedNodeHeight(draggedEntry),
                minHeight: getRenderedNodeMinHeight(draggedEntry),
                ...getNodeBranchStyle(draggedEntry),
              }}
            >
              <strong>{draggedEntry.node.title}</strong>
              {draggedEntry.node.note.trim() ? <span className="note-dot"><NoteDotIcon /></span> : null}
            </article>
          ) : null}
          {nodes.map((entry) => {
            const isTitleEditing = titleEditor?.nodeId === entry.node.id;
            const renderedHeight = getRenderedNodeHeight(entry);

            return (
            <article
              className={`mind-node level-${entry.node.level} ${isTitleEditing ? "editing" : ""} ${selectedSet.has(entry.node.id) ? "selected" : ""} ${props.selectedIds.length > 1 && selectedSet.has(entry.node.id) ? "multi-selected" : ""} ${nodeDrag?.nodeId === entry.node.id ? "drag-source" : ""} ${nodeResize?.nodeId === entry.node.id ? "resizing" : ""} ${activeDropIntent?.targetId === entry.node.id ? "drop-target" : ""}`}
              data-branch-side={getBranchSide(entry)}
              data-has-note={entry.node.note.trim() ? "true" : "false"}
              data-node-depth={getNodeDepth(entry)}
              data-resizing={nodeResize?.nodeId === entry.node.id ? "true" : "false"}
              key={entry.node.id}
              style={{
                left: getRenderedNodeLeft(entry),
                top: getRenderedNodeTop(entry),
                width: getRenderedNodeWidth(entry),
                maxWidth: NODE_MAX_WIDTH,
                height: renderedHeight,
                minHeight: getRenderedNodeMinHeight(entry),
                ...getNodeBranchStyle(entry),
              }}
              onClick={(event) => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                if (props.selectedIds.length > 1 && !selectedSet.has(entry.node.id) && !event.ctrlKey && !isCtrlSelecting) {
                  props.onClearSelection();
                } else if (event.ctrlKey || isCtrlSelecting) {
                  const next = selectedSet.has(entry.node.id)
                    ? props.selectedIds.filter((nodeId) => nodeId !== entry.node.id)
                    : [...props.selectedIds, entry.node.id];
                  props.onSelectMany(next.length ? next : [entry.node.id]);
                } else {
                  props.onSelect(entry.node.id);
                }
                setSelectedFrameId(null);
                setPinnedNoteId((current) => (current === entry.node.id ? null : entry.node.id));
                syncOpenNoteDrawer(entry.node);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (!props.readOnly) {
                  startTitleEdit(entry.node);
                }
              }}
              onMouseDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                if (props.selectedIds.length > 1 && !selectedSet.has(entry.node.id) && !event.ctrlKey && !isCtrlSelecting) {
                  event.preventDefault();
                  event.stopPropagation();
                  props.onClearSelection();
                  return;
                }
                if (event.ctrlKey || isCtrlSelecting) {
                  event.stopPropagation();
                  return;
                }
                if (isSpacePanning) {
                  return;
                }
                if (event.target instanceof HTMLElement && event.target.closest("button")) {
                  return;
                }
                if (event.target instanceof HTMLElement && event.target.closest(".node-resize-handle")) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                setMenu(null);
                setSelectedFrameId(null);
                if (entry.node.id === props.root.id) {
                  props.onSelect(entry.node.id);
                  syncOpenNoteDrawer(entry.node);
                  setDragStart({
                    x: event.clientX,
                    y: event.clientY,
                    panX: pan.x,
                    panY: pan.y,
                    clearSelectionOnClick: false,
                  });
                  return;
                }
                props.onSelect(entry.node.id);
                syncOpenNoteDrawer(entry.node);
                if (props.readOnly) {
                  return;
                }
                const rect = event.currentTarget.getBoundingClientRect();
                setNodeDrag({
                  nodeId: entry.node.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  pointerOffsetX: event.clientX - rect.left,
                  pointerOffsetY: event.clientY - rect.top,
                  width: rect.width,
                  height: rect.height,
                });
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (props.readOnly) {
                  return;
                }
                props.onSelect(entry.node.id);
                setMenu({ node: entry.node, x: event.clientX, y: event.clientY });
              }}
            >
              {isTitleEditing ? (
                <textarea
                  aria-label="编辑节点标题"
                  autoFocus
                  className="node-title-input"
                  ref={titleInputRef}
                  rows={1}
                  value={titleEditor.value}
                  onBlur={saveTitleEdit}
                  onChange={(event) => setTitleEditor({ ...titleEditor, value: event.target.value })}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onInput={(event) => resizeTitleInput(event.currentTarget)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      if (event.ctrlKey) {
                        event.preventDefault();
                        insertTitleLineBreak(event.currentTarget);
                        return;
                      }
                      event.preventDefault();
                      saveTitleEdit();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setTitleEditor(null);
                    }
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                />
              ) : (
                <strong>{entry.node.title}</strong>
              )}
              {entry.node.note.trim() ? <span className="note-dot"><NoteDotIcon /></span> : null}
              {entry.node.note.trim() && (pinnedNoteId === entry.node.id) ? <NoteBubble note={entry.node.note} pinned /> : null}
              {entry.node.note.trim() ? <NoteBubble note={entry.node.note} /> : null}
              {!props.readOnly ? RESIZE_HANDLES.map((handle) => (
                <span
                  aria-hidden="true"
                  className={`node-resize-handle ${handle.name}`}
                  key={handle.name}
                  onMouseDown={(event) => startNodeResize(event, entry, handle.directionX, handle.directionY)}
                />
              )) : null}
            </article>
            );
          })}
        </div>
      </div>
      {menu ? (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
          <button onClick={() => { props.onAddChild(menu.node.id); setMenu(null); }}>新增子节点</button>
          <button onClick={() => startTitleEdit(menu.node)}>编辑标题</button>
          <button onClick={() => openNoteDrawer(menu.node)}>编辑批注</button>
          <button
            disabled={menu.node.id === props.root.id}
            onClick={() => requestDelete([menu.node.id])}
            title={menu.node.id === props.root.id ? "根节点不能删除" : undefined}
          >
            删除节点
          </button>
        </div>
      ) : null}
      {noteDrawer ? (
        <aside className="note-drawer" aria-label={props.readOnly ? "查看批注" : "编辑批注"}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveNoteDrawer();
            }}
          >
            <header>
              <div>
                <span>{props.readOnly ? "查看批注" : "编辑批注"}</span>
                <strong>{noteDrawer.node.title}</strong>
              </div>
              <button aria-label="关闭" onClick={() => setNoteDrawer(null)} type="button"><XIcon /></button>
            </header>
            {noteDrawer.mode === "read" ? (
              <div className="note-drawer-content">
                {noteDrawer.value.trim() ? (
                  <NoteMarkdownContent note={noteDrawer.value} />
                ) : (
                  <p className="empty-note">暂无批注</p>
                )}
              </div>
            ) : (
              <label className="node-dialog-field note-editor-field">
                <span>节点批注</span>
                <textarea
                  ref={noteInputRef}
                  value={noteDrawer.value}
                  onChange={(event) => setNoteDrawer({ ...noteDrawer, value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setNoteDrawer(null);
                  }}
                />
              </label>
            )}
            <footer>
              {noteDrawer.mode === "read" ? (
                <>
                  <button type="button" onClick={() => setNoteDrawer(null)}>关闭</button>
                  {!props.readOnly ? (
                    <button
                      className="primary"
                      type="button"
                      onClick={() => setNoteDrawer({ ...noteDrawer, mode: "edit" })}
                    >
                      编辑
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setNoteDrawer({ ...noteDrawer, mode: "read" })}>阅读</button>
                  <button className="primary" type="submit">保存</button>
                </>
              )}
            </footer>
          </form>
        </aside>
      ) : null}
      {deleteTarget ? (
        <div className="modal-backdrop node-dialog-backdrop" onMouseDown={() => setDeleteTarget(null)}>
          <section
            aria-modal="true"
            className="node-dialog danger"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <div>
                <span>删除节点</span>
                <strong>{deleteTarget.title}</strong>
              </div>
              <button aria-label="关闭" onClick={() => setDeleteTarget(null)} type="button"><XIcon /></button>
            </header>
            <p>{deleteTarget.count === 1 ? "会同时删除它下面的全部子节点。" : "会同时删除这些节点下面的全部子节点。"}</p>
            <footer>
              <button type="button" onClick={() => setDeleteTarget(null)}>取消</button>
              <button className="danger-button" type="button" onClick={confirmDelete}>删除</button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
