import { useEffect, useMemo, useRef, useState } from "react";
import { layoutTree } from "../domain/pngExport";
import type { MindNode } from "../domain/types";
import { NoteBubble } from "./NoteBubble";

interface MindMapCanvasProps {
  root: MindNode;
  selectedId?: string;
  onSelect: (nodeId: string) => void;
  onAddChild: (nodeId: string) => void;
  onEditTitle: (nodeId: string, title: string) => void;
  onEditNote: (nodeId: string, note: string) => void;
  onDelete: (nodeId: string) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 54;
const PADDING = 160;

type NodeEditor = {
  kind: "title" | "note";
  node: MindNode;
  value: string;
};

export function MindMapCanvas(props: MindMapCanvasProps) {
  const nodes = useMemo(() => layoutTree(props.root), [props.root]);
  const byId = useMemo(() => new Map(nodes.map((entry) => [entry.node.id, entry])), [nodes]);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [menu, setMenu] = useState<{ node: MindNode; x: number; y: number } | null>(null);
  const [pinnedNoteId, setPinnedNoteId] = useState<string | null>(null);
  const [editor, setEditor] = useState<NodeEditor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MindNode | null>(null);
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

  function requestDelete(node: MindNode): void {
    setDeleteTarget(node);
    setEditor(null);
    setMenu(null);
  }

  function confirmDelete(): void {
    if (!deleteTarget) return;

    props.onDelete(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section
      className="map-shell"
      onMouseMove={(event) => {
        if (!dragStart) return;
        setPan({
          x: dragStart.panX + event.clientX - dragStart.x,
          y: dragStart.panY + event.clientY - dragStart.y,
        });
      }}
      onMouseUp={() => setDragStart(null)}
      onMouseLeave={() => setDragStart(null)}
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
        className="map-viewport"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setMenu(null);
            setDragStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
          }
        }}
      >
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
              className={`mind-node level-${entry.node.level} ${props.selectedId === entry.node.id ? "selected" : ""}`}
              key={entry.node.id}
              style={{ left: PADDING + entry.x, top: PADDING + entry.y }}
              onClick={() => {
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
              <button className="node-add" onClick={(event) => { event.stopPropagation(); props.onAddChild(entry.node.id); }}>＋</button>
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
            onClick={() => requestDelete(menu.node)}
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
            <p>会同时删除它下面的全部子节点。</p>
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
