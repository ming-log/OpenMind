import { useEffect, useMemo, useRef, useState } from "react";
import { layoutTree } from "../domain/pngExport";
import { getIntersectingNodeIds, normalizeSelectionBox, type SelectableNodeRect, type SelectionBox } from "../domain/selection";
import type { MindNode } from "../domain/types";
import { NoteBubble } from "./NoteBubble";

interface MindMapCanvasProps {
  root: MindNode;
  selectedId?: string;
  selectedIds: string[];
  onSelect: (nodeId: string) => void;
  onSelectMany: (nodeIds: string[]) => void;
  onAddChild: (nodeId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onEditTitle: (nodeId: string, title: string) => void;
  onEditNote: (nodeId: string, note: string) => void;
  onDeleteSelection: (nodeIds: string[]) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 54;
const PADDING = 160;

type NodeEditor = {
  kind: "title" | "note";
  node: MindNode;
  value: string;
};

type DeleteTarget = {
  nodeIds: string[];
  title: string;
  count: number;
};

export function MindMapCanvas(props: MindMapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const nodes = useMemo(() => layoutTree(props.root), [props.root]);
  const byId = useMemo(() => new Map(nodes.map((entry) => [entry.node.id, entry])), [nodes]);
  const selectedSet = useMemo(() => new Set(props.selectedIds), [props.selectedIds]);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isCtrlSelecting, setIsCtrlSelecting] = useState(false);
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const [menu, setMenu] = useState<{ node: MindNode; x: number; y: number } | null>(null);
  const [pinnedNoteId, setPinnedNoteId] = useState<string | null>(null);
  const [editor, setEditor] = useState<NodeEditor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const width = Math.max(...nodes.map((entry) => entry.x)) + NODE_WIDTH + PADDING * 2;
  const height = Math.max(...nodes.map((entry) => entry.y)) + NODE_HEIGHT + PADDING * 2;

  useEffect(() => {
    if (!editor) return;

    if (editor.kind === "title") {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
      return;
    }

    noteInputRef.current?.focus();
  }, [editor]);

  function openEditor(node: MindNode, kind: NodeEditor["kind"]): void {
    setEditor({
      kind,
      node,
      value: kind === "title" ? node.title : node.note,
    });
    setDeleteTarget(null);
    setMenu(null);
  }

  function saveEditor(): void {
    if (!editor) return;

    if (editor.kind === "title") {
      props.onEditTitle(editor.node.id, editor.value);
    } else {
      props.onEditNote(editor.node.id, editor.value);
    }

    setEditor(null);
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
    setEditor(null);
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
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
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

  useEffect(() => {
    function keydown(event: KeyboardEvent): void {
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
          openEditor(selected.node, "note");
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
  }, [byId, props]);

  const normalizedSelection = selectionBox ? normalizeSelectionBox(selectionBox) : null;

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
        event.preventDefault();
        setScale((value) => Math.min(1.8, Math.max(0.35, value - event.deltaY * 0.001)));
      }}
    >
      <div className="canvas-controls">
        <button onClick={() => setScale((value) => Math.max(0.35, value - 0.1))}>−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((value) => Math.min(1.8, value + 0.1))}>＋</button>
        <button onClick={() => { setPan({ x: 80, y: 80 }); setScale(1); }}>⌂</button>
        <button
          onClick={() => {
            const selected = props.selectedId ? byId.get(props.selectedId) : byId.get(props.root.id);
            if (selected) {
              setPan({ x: 220 - PADDING - selected.x * scale, y: 220 - PADDING - selected.y * scale });
            }
          }}
          title="聚焦选中节点"
        >
          ⌖
        </button>
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
                const startX = PADDING + entry.x + NODE_WIDTH;
                const startY = PADDING + entry.y + NODE_HEIGHT / 2;
                const endX = PADDING + childEntry.x;
                const endY = PADDING + childEntry.y + NODE_HEIGHT / 2;
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
          {nodes.map((entry) => (
            <article
              className={`mind-node level-${entry.node.level} ${selectedSet.has(entry.node.id) ? "selected" : ""} ${props.selectedIds.length > 1 && selectedSet.has(entry.node.id) ? "multi-selected" : ""}`}
              key={entry.node.id}
              style={{ left: PADDING + entry.x, top: PADDING + entry.y }}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                props.onSelect(entry.node.id);
                setPinnedNoteId((current) => (current === entry.node.id ? null : entry.node.id));
              }}
              onDoubleClick={() => openEditor(entry.node, "title")}
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
                  props.onAddChild(entry.node.id);
                }}
              >
                ＋
              </button>
              <strong>{entry.node.title}</strong>
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
          <button onClick={() => openEditor(menu.node, "title")}>编辑标题</button>
          <button onClick={() => openEditor(menu.node, "note")}>编辑批注</button>
          <button
            disabled={menu.node.id === props.root.id}
            onClick={() => requestDelete([menu.node.id])}
            title={menu.node.id === props.root.id ? "根节点不能删除" : undefined}
          >
            删除节点
          </button>
        </div>
      ) : null}
      {editor ? (
        <div className="modal-backdrop node-dialog-backdrop" onMouseDown={() => setEditor(null)}>
          <form
            aria-modal="true"
            className="node-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              saveEditor();
            }}
            role="dialog"
          >
            <header>
              <div>
                <span>{editor.kind === "title" ? "编辑标题" : "编辑批注"}</span>
                <strong>{editor.node.title}</strong>
              </div>
              <button aria-label="关闭" onClick={() => setEditor(null)} type="button">×</button>
            </header>
            <label className="node-dialog-field">
              <span>{editor.kind === "title" ? "节点标题" : "节点批注"}</span>
              {editor.kind === "title" ? (
                <input
                  ref={titleInputRef}
                  value={editor.value}
                  onChange={(event) => setEditor({ ...editor, value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEditor(null);
                  }}
                />
              ) : (
                <textarea
                  ref={noteInputRef}
                  rows={5}
                  value={editor.value}
                  onChange={(event) => setEditor({ ...editor, value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEditor(null);
                  }}
                />
              )}
            </label>
            <footer>
              <button type="button" onClick={() => setEditor(null)}>取消</button>
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
