import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { calculateCenteredPan, calculateFitScale, findDropIntent, type DropIntent, type DropNodeRect } from "../domain/canvasLayout";
import { layoutTree } from "../domain/pngExport";
import { getIntersectingNodeIds, normalizeSelectionBox, type SelectableNodeRect, type SelectionBox } from "../domain/selection";
import type { GroupFrame, MindNode } from "../domain/types";
import { NoteBubble, NoteMarkdownContent } from "./NoteBubble";

interface MindMapCanvasProps {
  root: MindNode;
  groupFrames: GroupFrame[];
  selectedId?: string;
  selectedIds: string[];
  onSelect: (nodeId: string) => void;
  onSelectMany: (nodeIds: string[]) => void;
  onClearSelection: () => void;
  onAddChild: (nodeId: string, side?: "left" | "right") => void;
  onAddSibling: (nodeId: string) => void;
  onEditTitle: (nodeId: string, title: string) => void;
  onEditNote: (nodeId: string, note: string) => void;
  onDeleteSelection: (nodeIds: string[]) => void;
  onMoveSubtree: (nodeId: string, newParentId: string, index: number, side?: "left" | "right") => void;
  onCreateGroupFrame: (nodeIds: string[]) => void;
  onUpdateGroupFrameNote: (frameId: string, note: string) => void;
  onDeleteGroupFrame: (frameId: string) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 54;
const PADDING = 160;
const MIN_SCALE = 0.1;
const MAX_SCALE = 1.8;

type DeleteTarget = {
  nodeIds: string[];
  title: string;
  count: number;
};

type NodeDrag = {
  nodeId: string;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
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

export function MindMapCanvas(props: MindMapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const pendingCenterRef = useRef(false);
  const nodes = useMemo(() => layoutTree(props.root), [props.root]);
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
  const selectedSet = useMemo(() => new Set(props.selectedIds), [props.selectedIds]);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isCtrlSelecting, setIsCtrlSelecting] = useState(false);
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const [menu, setMenu] = useState<{ node: MindNode; x: number; y: number } | null>(null);
  const [pinnedNoteId, setPinnedNoteId] = useState<string | null>(null);
  const [titleEditor, setTitleEditor] = useState<TitleEditor | null>(null);
  const [noteDrawer, setNoteDrawer] = useState<NoteDrawer | null>(null);
  const [frameEditor, setFrameEditor] = useState<FrameEditor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const width = Math.max(...nodes.map((entry) => entry.x)) + NODE_WIDTH + PADDING * 2;
  const height = Math.max(...nodes.map((entry) => entry.y)) + NODE_HEIGHT + PADDING * 2;
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
  const nodeDragOffset = nodeDrag ? { x: nodeDrag.deltaX / scale, y: nodeDrag.deltaY / scale } : { x: 0, y: 0 };

  useEffect(() => {
    if (!noteDrawer || noteDrawer.mode !== "edit") return;
    noteInputRef.current?.focus();
  }, [noteDrawer]);

  useEffect(() => {
    window.requestAnimationFrame(() => focusNode(props.root.id, 1));
  }, [props.root.id]);

  useEffect(() => {
    if (!pendingCenterRef.current) {
      return;
    }

    pendingCenterRef.current = false;
    window.requestAnimationFrame(() => centerMap());
  }, [height, width]);

  function startTitleEdit(node: MindNode): void {
    setTitleEditor({ nodeId: node.id, value: node.title });
    setDeleteTarget(null);
    setMenu(null);
  }

  function saveTitleEdit(): void {
    if (!titleEditor) return;

    props.onEditTitle(titleEditor.nodeId, titleEditor.value);
    setTitleEditor(null);
  }

  function openNoteDrawer(node: MindNode): void {
    setNoteDrawer({ node, value: node.note, mode: "read" });
    setDeleteTarget(null);
    setMenu(null);
  }

  function saveNoteDrawer(): void {
    if (!noteDrawer) return;

    props.onEditNote(noteDrawer.node.id, noteDrawer.value);
    setNoteDrawer(null);
  }

  function requestDelete(nodeIds: string[]): void {
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
      left: pan.x + (PADDING + entry.x) * scale,
      top: pan.y + (PADDING + entry.y) * scale,
      width: NODE_WIDTH * scale,
      height: NODE_HEIGHT * scale,
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

    setPan(calculateCenteredPan({
      viewportWidth: rect.width,
      viewportHeight: rect.height,
      contentWidth: width,
      contentHeight: height,
      scale: nextScale,
    }));
  }

  function getDropNodeRects(): DropNodeRect[] {
    return nodes.map((entry) => {
      const relation = nodeRelations.get(entry.node.id) ?? { parentId: props.root.id, index: 0 };
      return {
        id: entry.node.id,
        parentId: relation.parentId,
        index: relation.index,
        left: pan.x + (PADDING + entry.x) * scale,
        top: pan.y + (PADDING + entry.y) * scale,
        width: NODE_WIDTH * scale,
        height: NODE_HEIGHT * scale,
      };
    });
  }

  function finishNodeDrag(drag: NodeDrag, clientX: number, clientY: number, excludedIds: Set<string>): void {
    const intent = findDropIntent(getViewportPointFromClient(clientX, clientY), getDropNodeRects(), excludedIds);
    if (intent) {
      pendingCenterRef.current = true;
      props.onMoveSubtree(drag.nodeId, intent.parentId, intent.index, intent.side);
    } else {
      centerMap();
    }
    setNodeDrag(null);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    function wheel(event: WheelEvent): void {
      if (!event.ctrlKey) {
        return;
      }
      event.preventDefault();
      setScale((value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value - event.deltaY * 0.001)));
    }

    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, []);

  useEffect(() => {
    if (!nodeDrag) {
      return;
    }
    const activeDrag = nodeDrag;

    function mousemove(event: MouseEvent): void {
      suppressClickRef.current = true;
      setNodeDrag((current) => current
        ? {
          ...current,
          deltaX: event.clientX - current.startX,
          deltaY: event.clientY - current.startY,
        }
        : current);
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
  }, [draggedIds, nodeDrag, props]);

  useEffect(() => {
    function keydown(event: KeyboardEvent): void {
      const overlayOpen = titleEditor || noteDrawer || deleteTarget || menu || frameEditor;
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
      setNodeDrag(null);
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
  }, [byId, deleteTarget, frameEditor, menu, noteDrawer, props, titleEditor]);

  const normalizedSelection = selectionBox ? normalizeSelectionBox(selectionBox) : null;
  const activeDropIntent = nodeDrag
    ? findDropIntent(getViewportPointFromClient(nodeDrag.startX + nodeDrag.deltaX, nodeDrag.startY + nodeDrag.deltaY), getDropNodeRects(), draggedIds)
    : undefined;

  function getDropPreviewStyle(intent: DropIntent): CSSProperties | undefined {
    const target = byId.get(intent.targetId);
    if (!target) {
      return undefined;
    }

    if (intent.placement === "inside") {
      const leftSide = intent.side === "left";
      return {
        left: PADDING + target.x + (leftSide ? -100 : NODE_WIDTH + 26),
        top: PADDING + target.y + NODE_HEIGHT / 2 - 2,
        width: 74,
      };
    }

    return {
      left: PADDING + target.x - 8,
      top: PADDING + target.y + (intent.placement === "before" ? -8 : NODE_HEIGHT + 6),
      width: NODE_WIDTH + 16,
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
    setScale(nextScale);
    setPan(calculateCenteredPan({
      viewportWidth: rect.width,
      viewportHeight: rect.height,
      contentWidth: width,
      contentHeight: height,
      scale: nextScale,
    }));
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

    const targetX = rect.width / 2 - (NODE_WIDTH * nextScale) / 2;
    const targetY = rect.height / 2 - (NODE_HEIGHT * nextScale) / 2;
    setScale(nextScale);
    setPan({
      x: targetX - (PADDING + selected.x) * nextScale,
      y: targetY - (PADDING + selected.y) * nextScale,
    });
  }

  function getFrameStyle(frame: GroupFrame): CSSProperties | undefined {
    const entries = frame.nodeIds
      .map((nodeId) => byId.get(nodeId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    if (entries.length < 2) {
      return undefined;
    }

    const left = Math.min(...entries.map((entry) => PADDING + entry.x));
    const top = Math.min(...entries.map((entry) => PADDING + entry.y));
    const right = Math.max(...entries.map((entry) => PADDING + entry.x + NODE_WIDTH));
    const bottom = Math.max(...entries.map((entry) => PADDING + entry.y + NODE_HEIGHT));
    return {
      left: left - 24,
      top: top - 28,
      width: right - left + 48,
      height: bottom - top + 56,
    };
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
          setPan({
            x: dragStart.panX + event.clientX - dragStart.x,
            y: dragStart.panY + event.clientY - dragStart.y,
          });
        }
      }}
      onMouseUp={(event) => {
        if (selectionBox) {
          const point = getViewportPoint(event);
          const finalSelection = { ...selectionBox, endX: point.x, endY: point.y };
          const selected = getIntersectingNodeIds(finalSelection, getSelectableNodeRects());
          if (selected.length) {
            props.onSelectMany(selected);
          }
          setSelectionBox(null);
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
      onWheel={(event) => {
        if (event.ctrlKey) {
          event.preventDefault();
          setScale((value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value - event.deltaY * 0.001)));
        }
      }}
    >
      <div className="canvas-controls">
        <button onClick={() => setScale((value) => Math.max(MIN_SCALE, value - 0.1))}>−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((value) => Math.min(MAX_SCALE, value + 0.1))}>＋</button>
        <button
          onClick={() => {
            fitAndCenterMap();
          }}
          title="自动排版并居中"
        >
          ⌂
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
        >
          ⌖
        </button>
        {props.selectedIds.length > 0 ? (
          <button onClick={() => props.onCreateGroupFrame(props.selectedIds)} title="为选中节点添加外框">
            □
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
            event.preventDefault();
            setMenu(null);
            suppressClickRef.current = true;
            setDragStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
            return;
          }
          if (event.target === event.currentTarget) {
            setMenu(null);
            if (props.selectedIds.length > 1) {
              props.onClearSelection();
              return;
            }
            setDragStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
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
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && props.selectedIds.length > 1) {
              props.onClearSelection();
            }
          }}
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
                const parentDragged = draggedIds.has(entry.node.id);
                const childDragged = draggedIds.has(child.id);
                const childIsLeft = childEntry.x < entry.x;
                const startX = PADDING + entry.x + (childIsLeft ? 0 : NODE_WIDTH) + (parentDragged ? nodeDragOffset.x : 0);
                const startY = PADDING + entry.y + NODE_HEIGHT / 2 + (parentDragged ? nodeDragOffset.y : 0);
                const endX = PADDING + childEntry.x + (childIsLeft ? NODE_WIDTH : 0) + (childDragged ? nodeDragOffset.x : 0);
                const endY = PADDING + childEntry.y + NODE_HEIGHT / 2 + (childDragged ? nodeDragOffset.y : 0);
                const midX = (startX + endX) / 2;
                return (
                  <path
                    key={`${entry.node.id}-${child.id}`}
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
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
          {props.groupFrames.map((frame) => {
            const style = getFrameStyle(frame);
            if (!style) return null;
            return (
              <div className="group-frame" key={frame.id} style={style}>
                <button
                   className="group-frame-note"
                   onClick={(event) => {
                     event.stopPropagation();
                     setFrameEditor({ frameId: frame.id, value: frame.note });
                   }}
                   type="button"
                >
                  {frame.note || "备注"}
                </button>
                <button
                  aria-label="删除外框"
                  className="group-frame-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onDeleteGroupFrame(frame.id);
                  }}
                  title="删除外框"
                  type="button"
                >
                  ×
                </button>
              </div>
            );
          })}
          {nodes.map((entry) => (
            <article
              className={`mind-node level-${entry.node.level} ${selectedSet.has(entry.node.id) ? "selected" : ""} ${props.selectedIds.length > 1 && selectedSet.has(entry.node.id) ? "multi-selected" : ""} ${draggedIds.has(entry.node.id) ? "dragging" : ""} ${activeDropIntent?.targetId === entry.node.id ? "drop-target" : ""}`}
              key={entry.node.id}
              style={{
                left: PADDING + entry.x,
                top: PADDING + entry.y,
                transform: draggedIds.has(entry.node.id) ? `translate(${nodeDragOffset.x}px, ${nodeDragOffset.y}px)` : undefined,
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
                setPinnedNoteId((current) => (current === entry.node.id ? null : entry.node.id));
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                startTitleEdit(entry.node);
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

                event.preventDefault();
                event.stopPropagation();
                setMenu(null);
                if (entry.node.id === props.root.id) {
                  props.onSelect(entry.node.id);
                  setDragStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
                  return;
                }
                props.onSelect(entry.node.id);
                setNodeDrag({
                  nodeId: entry.node.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  deltaX: 0,
                  deltaY: 0,
                });
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                props.onSelect(entry.node.id);
                setMenu({ node: entry.node, x: event.clientX, y: event.clientY });
              }}
            >
              <button
                className="node-add"
                onClick={(event) => {
                  event.stopPropagation();
                  if (suppressClickRef.current) {
                    event.preventDefault();
                    return;
                  }
                  props.onAddChild(entry.node.id, "right");
                }}
              >
                ＋
              </button>
              {entry.node.id === props.root.id ? (
                <button
                  className="node-add node-add-left"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (suppressClickRef.current) {
                      event.preventDefault();
                      return;
                    }
                    props.onAddChild(entry.node.id, "left");
                  }}
                  title="在左侧新增节点"
                >
                  ＋
                </button>
              ) : null}
              {titleEditor?.nodeId === entry.node.id ? (
                <input
                  autoFocus
                  className="node-title-input"
                  value={titleEditor.value}
                  onBlur={saveTitleEdit}
                  onChange={(event) => setTitleEditor({ ...titleEditor, value: event.target.value })}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveTitleEdit();
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
              {entry.node.note.trim() ? <span className="note-dot">●</span> : null}
              {entry.node.note.trim() && (pinnedNoteId === entry.node.id) ? <NoteBubble note={entry.node.note} pinned /> : null}
              {entry.node.note.trim() ? <NoteBubble note={entry.node.note} /> : null}
            </article>
          ))}
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
        <aside className="note-drawer" aria-label="编辑批注">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveNoteDrawer();
            }}
          >
            <header>
              <div>
                <span>编辑批注</span>
                <strong>{noteDrawer.node.title}</strong>
              </div>
              <button aria-label="关闭" onClick={() => setNoteDrawer(null)} type="button">×</button>
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
                  <button
                    className="primary"
                    type="button"
                    onClick={() => setNoteDrawer({ ...noteDrawer, mode: "edit" })}
                  >
                    编辑
                  </button>
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
      {frameEditor ? (
        <div className="modal-backdrop node-dialog-backdrop" onMouseDown={() => setFrameEditor(null)}>
          <form
            aria-modal="true"
            className="node-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              props.onUpdateGroupFrameNote(frameEditor.frameId, frameEditor.value);
              setFrameEditor(null);
            }}
            role="dialog"
          >
            <header>
              <div>
                <span>外框备注</span>
                <strong>编辑备注</strong>
              </div>
              <button aria-label="关闭" onClick={() => setFrameEditor(null)} type="button">×</button>
            </header>
            <label className="node-dialog-field">
              <span>备注内容</span>
              <textarea
                autoFocus
                rows={4}
                value={frameEditor.value}
                onChange={(event) => setFrameEditor({ ...frameEditor, value: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setFrameEditor(null);
                }}
              />
            </label>
            <footer>
              <button type="button" onClick={() => setFrameEditor(null)}>取消</button>
              <button className="primary" type="submit">保存</button>
            </footer>
          </form>
        </div>
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
              <button aria-label="关闭" onClick={() => setDeleteTarget(null)} type="button">×</button>
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
