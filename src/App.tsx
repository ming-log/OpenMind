import { useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { MindMapCanvas } from "./components/MindMapCanvas";
import { SettingsModal } from "./components/SettingsModal";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { ChevronLeftIcon, ChevronRightIcon, StatusDotIcon, TrashIcon, XIcon } from "./components/Icons";
import { deleteDocumentById } from "./domain/documents";
import { createNodeId } from "./domain/ids";
import { createDefaultDocument, MULTIPLE_H1_NORMALIZED_WARNING, parseMarkdown, serializeMarkdown } from "./domain/markdown";
import { exportTreeAsPng } from "./domain/pngExport";
import { loadPersistedState, savePersistedState } from "./domain/storage";
import { synchronizeDocument, testWebDavConnection } from "./domain/sync";
import { addChildNode, addSiblingNode, collectSubtreeIds, deleteNodes, moveSubtree, updateNodeNote, updateNodeTitle } from "./domain/tree";
import type { BackupEntry, DocumentState, GroupFrame, WebDavConfig } from "./domain/types";

type Mode = "map" | "markdown";
type TaskDeleteTarget = {
  documentId: string;
  title: string;
};

function downloadText(fileName: string, text: string): void {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  link.click();
  URL.revokeObjectURL(link.href);
}

function taskTitle(document: DocumentState): string {
  return document.fileName.replace(/\.md$/i, "") || "未命名任务";
}

function markDirty(
  document: DocumentState,
  markdown: string,
  root = document.root,
  warnings = document.warnings,
  groupFrames = document.groupFrames ?? [],
): DocumentState {
  return {
    ...document,
    markdown,
    root,
    groupFrames,
    warnings,
    localModifiedAt: new Date().toISOString(),
    saveStatus: markdown === document.lastSavedMarkdown ? "saved" : "dirty",
    syncError: undefined,
  };
}

function ensureDocumentId(document: DocumentState): DocumentState {
  return {
    ...document,
    id: document.id ?? createNodeId("task"),
    groupFrames: document.groupFrames ?? [],
  };
}

export default function App() {
  const initial = loadPersistedState();
  const initialDocuments = (initial.documents?.length ? initial.documents : [initial.document]).map(ensureDocumentId);
  const initialActiveDocument = initialDocuments.find((document) => document.id === initial.activeDocumentId) ?? initialDocuments[0];
  const [documents, setDocuments] = useState<DocumentState[]>(initialDocuments);
  const [activeDocumentId, setActiveDocumentId] = useState(initialActiveDocument.id ?? "");
  const [documentState, setDocumentState] = useState<DocumentState>(initialActiveDocument);
  const [backups, setBackups] = useState<BackupEntry[]>(initial.backups);
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>(initial.webDavConfig);
  const [mode, setMode] = useState<Mode>("map");
  const [selectedIds, setSelectedIds] = useState<string[]>([initialActiveDocument.root.id]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskDeleteTarget, setTaskDeleteTarget] = useState<TaskDeleteTarget | null>(null);
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const undoStacksRef = useRef<Record<string, DocumentState[]>>({});
  const selectedId = selectedIds[0];

  useEffect(() => {
    savePersistedState(window.localStorage, {
      document: documentState,
      documents,
      activeDocumentId,
      backups,
      webDavConfig,
    });
  }, [activeDocumentId, backups, documentState, documents, webDavConfig]);

  useEffect(() => {
    function keydown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoLastChange();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveCurrentTask();
      }
    }

    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  function commitDocument(next: DocumentState): void {
    const ensured = ensureDocumentId(next);
    setDocumentState(ensured);
    setActiveDocumentId(ensured.id ?? "");
    setDocuments((current) => {
      const exists = current.some((document) => document.id === ensured.id);
      return exists
        ? current.map((document) => (document.id === ensured.id ? ensured : document))
        : [...current, ensured];
    });
  }

  function commitUndoable(next: DocumentState): void {
    const documentId = documentState.id ?? activeDocumentId;
    undoStacksRef.current = {
      ...undoStacksRef.current,
      [documentId]: [documentState, ...(undoStacksRef.current[documentId] ?? [])].slice(0, 80),
    };
    commitDocument(next);
  }

  function undoLastChange(): void {
    const documentId = documentState.id ?? activeDocumentId;
    const stack = undoStacksRef.current[documentId] ?? [];
    const previous = stack[0];
    if (!previous) {
      setMessage("没有可撤销的操作");
      return;
    }

    undoStacksRef.current = {
      ...undoStacksRef.current,
      [documentId]: stack.slice(1),
    };
    commitDocument(previous);
    setSelectedIds([previous.root.id]);
    setMessage("已撤销上次操作");
  }

  function replaceDocument(next: DocumentState): void {
    commitDocument(next);
    setSelectedIds([next.root.id]);
  }

  function newDocument(): void {
    replaceDocument(createDefaultDocument(`任务 ${documents.length + 1}`));
    setMode("map");
    setMessage("已新建任务");
  }

  function switchTask(documentId: string): void {
    const next = documents.find((document) => document.id === documentId);
    if (!next) return;
    setDocumentState(next);
    setActiveDocumentId(documentId);
    setSelectedIds([next.root.id]);
    setMode("map");
    setMessage(`已切换到 ${next.fileName}`);
  }

  function saveCurrentTask(): void {
    const saved = {
      ...documentState,
      lastSavedMarkdown: documentState.markdown,
      saveStatus: "saved" as const,
      localModifiedAt: new Date().toISOString(),
    };
    commitDocument(saved);
    setMessage("已保存当前任务");
  }

  function requestDeleteTask(document: DocumentState): void {
    if (!document.id) {
      return;
    }

    setTaskDeleteTarget({
      documentId: document.id,
      title: taskTitle(document),
    });
  }

  function confirmDeleteTask(): void {
    if (!taskDeleteTarget) {
      return;
    }

    const result = deleteDocumentById(documents, activeDocumentId, taskDeleteTarget.documentId);
    if (!result.deleted) {
      setTaskDeleteTarget(null);
      return;
    }

    undoStacksRef.current = Object.fromEntries(
      Object.entries(undoStacksRef.current).filter(([documentId]) => documentId !== taskDeleteTarget.documentId),
    );
    setDocuments(result.documents);
    setDocumentState(result.activeDocument);
    setActiveDocumentId(result.activeDocument.id ?? "");
    if (result.deletedActiveDocument) {
      setSelectedIds([result.activeDocument.root.id]);
      setMode("map");
    }
    setTaskDeleteTarget(null);
    setMessage("已删除任务");
  }

  function importMarkdown(file: File): void {
    file.text()
      .then((text) => {
        const parsed = parseMarkdown(text, file.name);
        const importedMarkdown = parsed.warnings.includes(MULTIPLE_H1_NORMALIZED_WARNING)
          ? serializeMarkdown(parsed.root)
          : text;
        replaceDocument({
          id: createNodeId("task"),
          fileName: file.name,
          markdown: importedMarkdown,
          root: parsed.root,
          groupFrames: [],
          localModifiedAt: new Date().toISOString(),
          lastSavedMarkdown: importedMarkdown,
          saveStatus: "saved",
          warnings: parsed.warnings,
        });
        setMode("map");
        setMessage("Markdown 已导入");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "导入失败"));
  }

  function switchMode(nextMode: Mode): void {
    if (nextMode === "map" && mode === "markdown") {
      const parsed = parseMarkdown(documentState.markdown, documentState.fileName);
      commitDocument({
        ...documentState,
        root: parsed.root,
        warnings: parsed.warnings,
      });
      setSelectedIds([parsed.root.id]);
    }
    setMode(nextMode);
  }

  function updateRoot(nextRoot: DocumentState["root"]): void {
    const markdown = serializeMarkdown(nextRoot);
    commitUndoable(markDirty(documentState, markdown, nextRoot, documentState.warnings));
  }

  function addChild(parentId: string, side?: "left" | "right"): void {
    const nodeId = createNodeId("node");
    updateRoot(addChildNode(documentState.root, parentId, "新节点", nodeId, side));
    setSelectedIds([nodeId]);
  }

  function addSibling(nodeId: string): void {
    const nextNodeId = createNodeId("node");
    updateRoot(addSiblingNode(documentState.root, nodeId, "新节点", nextNodeId));
    setSelectedIds([nextNodeId]);
  }

  function deleteSelection(nodeIds: string[]): void {
    const removableIds = Array.from(new Set(nodeIds)).filter((nodeId) => nodeId !== documentState.root.id);
    if (!removableIds.length) {
      setMessage("根节点不能删除");
      return;
    }

    updateRoot(deleteNodes(documentState.root, removableIds));
    setSelectedIds([documentState.root.id]);
    setMessage(removableIds.length === 1 ? "已删除节点" : `已删除 ${removableIds.length} 个节点`);
  }

  function moveNode(nodeId: string, newParentId: string, index: number, side?: "left" | "right"): void {
    const nextRoot = moveSubtree(documentState.root, nodeId, newParentId, index, side);
    if (nextRoot === documentState.root) {
      return;
    }

    updateRoot(nextRoot);
    setSelectedIds([nodeId]);
    setMessage("已移动节点");
  }

  function createGroupFrame(nodeIds: string[]): void {
    const uniqueIds = Array.from(new Set(nodeIds));
    if (uniqueIds.length < 1) {
      setMessage("请先选择节点");
      return;
    }

    const frameNodeIds = collectSubtreeIds(documentState.root, uniqueIds);
    const groupFrames: GroupFrame[] = [
      ...(documentState.groupFrames ?? []),
      { id: createNodeId("frame"), nodeIds: frameNodeIds, note: "备注" },
    ];
    commitUndoable(markDirty(documentState, documentState.markdown, documentState.root, documentState.warnings, groupFrames));
    setMessage("已添加外框");
  }

  function updateGroupFrameNote(frameId: string, note: string): void {
    const groupFrames = (documentState.groupFrames ?? []).map((frame) => (
      frame.id === frameId ? { ...frame, note } : frame
    ));
    commitUndoable(markDirty(documentState, documentState.markdown, documentState.root, documentState.warnings, groupFrames));
  }

  function deleteGroupFrame(frameId: string): void {
    const groupFrames = (documentState.groupFrames ?? []).filter((frame) => frame.id !== frameId);
    commitUndoable(markDirty(documentState, documentState.markdown, documentState.root, documentState.warnings, groupFrames));
    setMessage("已删除外框");
  }

  function syncNow(): void {
    if (!webDavConfig.serverUrl) {
      setSettingsOpen(true);
      setMessage("请先配置 WebDAV 服务器");
      return;
    }
    commitDocument({ ...documentState, saveStatus: "syncing", syncError: undefined });
    synchronizeDocument(documentState, webDavConfig)
      .then((result) => {
        const parsed = parseMarkdown(result.document.markdown, result.document.fileName);
        commitDocument({
          ...result.document,
          root: parsed.root,
          groupFrames: result.document.groupFrames ?? [],
          warnings: parsed.warnings,
        });
        setBackups((current) => [...result.backups, ...current]);
        setSelectedIds([parsed.root.id]);
        setMessage(result.message);
      })
      .catch((error: unknown) => {
        const text = error instanceof TypeError
          ? "同步失败：网络或 CORS 不可用，请确认 WebDAV 服务允许浏览器跨域访问。"
          : error instanceof Error ? error.message : "同步失败";
        commitDocument({ ...documentState, saveStatus: "syncFailed", syncError: text });
      });
  }

  return (
    <div className={`app ${focusMode ? "focus-mode" : ""}`}>
      <Toolbar
        mode={mode}
        status={documentState.saveStatus}
        onNew={newDocument}
        onImport={() => fileInputRef.current?.click()}
        onExportMarkdown={() => {
          downloadText(documentState.fileName, documentState.markdown);
          commitDocument({ ...documentState, lastSavedMarkdown: documentState.markdown, saveStatus: "saved" });
        }}
        onExportPng={() => exportTreeAsPng(documentState.root, documentState.fileName)}
        onSync={syncNow}
        onModeChange={switchMode}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".md,text/markdown,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importMarkdown(file);
          event.currentTarget.value = "";
        }}
      />
      <main className="workspace">
        <aside className={`task-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
          <button
            className="task-sidebar-toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            title={sidebarCollapsed ? "展开任务列表" : "折叠任务列表"}
            type="button"
          >
            {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
          {!sidebarCollapsed ? (
            <>
              <h2>任务列表</h2>
            <div className="task-list">
              {documents.map((document) => (
                <div
                  className={`task-row ${document.id === activeDocumentId ? "active" : ""}`}
                  key={document.id}
                >
                  <button
                    aria-current={document.id === activeDocumentId ? "page" : undefined}
                    className="task-open"
                    onClick={() => switchTask(document.id ?? "")}
                    type="button"
                  >
                    <span className="task-title">{taskTitle(document)}</span>
                    <span className={`task-status ${document.saveStatus === "dirty" ? "dirty" : "saved"}`}>
                      <StatusDotIcon />
                      {document.saveStatus === "dirty" ? "未保存" : "已保存"}
                    </span>
                  </button>
                  <button
                    aria-label={`删除任务 ${taskTitle(document)}`}
                    className="task-delete"
                    onClick={() => requestDeleteTask(document)}
                    title="删除任务"
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
            </>
          ) : null}
        </aside>
        {mode === "markdown" ? (
          <MarkdownEditor
            value={documentState.markdown}
            onChange={(markdown) => commitDocument(markDirty(documentState, markdown))}
          />
        ) : (
          <MindMapCanvas
            key={activeDocumentId}
            root={documentState.root}
            groupFrames={documentState.groupFrames ?? []}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelect={(nodeId) => setSelectedIds([nodeId])}
            onSelectMany={setSelectedIds}
            onClearSelection={() => setSelectedIds([])}
            onAddChild={addChild}
            onAddSibling={addSibling}
            onEditTitle={(nodeId, title) => updateRoot(updateNodeTitle(documentState.root, nodeId, title))}
            onEditNote={(nodeId, note) => updateRoot(updateNodeNote(documentState.root, nodeId, note))}
            onDeleteSelection={deleteSelection}
            onMoveSubtree={moveNode}
            onCreateGroupFrame={createGroupFrame}
            onUpdateGroupFrameNote={updateGroupFrameNote}
            onDeleteGroupFrame={deleteGroupFrame}
            focusMode={focusMode}
            onFocusModeChange={setFocusMode}
            shortcutsDisabled={taskDeleteTarget !== null}
          />
        )}
      </main>
      <StatusBar document={documentState} message={message} />
      {taskDeleteTarget ? (
        <div className="modal-backdrop node-dialog-backdrop" onMouseDown={() => setTaskDeleteTarget(null)}>
          <section
            aria-modal="true"
            className="node-dialog danger"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <div>
                <span>删除任务</span>
                <strong>{taskDeleteTarget.title}</strong>
              </div>
              <button aria-label="关闭" onClick={() => setTaskDeleteTarget(null)} type="button"><XIcon /></button>
            </header>
            <p>会从本机任务列表中删除这个任务；已导出的 Markdown 文件和备份不会被删除。</p>
            <footer>
              <button type="button" onClick={() => setTaskDeleteTarget(null)}>取消</button>
              <button className="danger-button" type="button" onClick={confirmDeleteTask}>删除任务</button>
            </footer>
          </section>
        </div>
      ) : null}
      {settingsOpen ? (
        <SettingsModal
          config={webDavConfig}
          backups={backups}
          testMessage={testMessage}
          onClose={() => setSettingsOpen(false)}
          onConfigChange={setWebDavConfig}
          onTestConnection={() => {
            setTestMessage("测试中...");
            testWebDavConnection(webDavConfig)
              .then((text) => setTestMessage(text))
              .catch((error: unknown) => {
                const text = error instanceof TypeError
                  ? "连接失败：网络或 CORS 不可用。"
                  : error instanceof Error ? error.message : "连接失败";
                setTestMessage(text);
              });
          }}
          onDownloadBackup={(backup) => downloadText(backup.fileName.replace(/\.md$/i, `-${backup.source}-${backup.createdAt}.md`), backup.markdown)}
        />
      ) : null}
    </div>
  );
}
