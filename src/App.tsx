import { useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { MindMapCanvas } from "./components/MindMapCanvas";
import { SettingsModal } from "./components/SettingsModal";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { createNodeId } from "./domain/ids";
import { createDefaultDocument, parseMarkdown, serializeMarkdown } from "./domain/markdown";
import { exportTreeAsPng } from "./domain/pngExport";
import { loadPersistedState, savePersistedState } from "./domain/storage";
import { synchronizeDocument, testWebDavConnection } from "./domain/sync";
import { addChildNode, addSiblingNode, deleteNodes, moveSubtree, updateNodeNote, updateNodeTitle } from "./domain/tree";
import type { BackupEntry, DocumentState, WebDavConfig } from "./domain/types";

type Mode = "map" | "markdown";

function downloadText(fileName: string, text: string): void {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  link.click();
  URL.revokeObjectURL(link.href);
}

function markDirty(document: DocumentState, markdown: string, root = document.root, warnings = document.warnings): DocumentState {
  return {
    ...document,
    markdown,
    root,
    warnings,
    localModifiedAt: new Date().toISOString(),
    saveStatus: markdown === document.lastSavedMarkdown ? "saved" : "dirty",
    syncError: undefined,
  };
}

export default function App() {
  const initial = loadPersistedState();
  const [documentState, setDocumentState] = useState<DocumentState>(initial.document);
  const [backups, setBackups] = useState<BackupEntry[]>(initial.backups);
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>(initial.webDavConfig);
  const [mode, setMode] = useState<Mode>("map");
  const [selectedIds, setSelectedIds] = useState<string[]>([initial.document.root.id]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedId = selectedIds[0] ?? documentState.root.id;

  useEffect(() => {
    savePersistedState(window.localStorage, {
      document: documentState,
      backups,
      webDavConfig,
    });
  }, [documentState, backups, webDavConfig]);

  function replaceDocument(next: DocumentState): void {
    setDocumentState(next);
    setSelectedIds([next.root.id]);
  }

  function newDocument(): void {
    if (documentState.saveStatus === "dirty" && !window.confirm("当前内容尚未保存，确认新建导图吗？")) {
      return;
    }
    replaceDocument(createDefaultDocument("OpenMind"));
    setMode("map");
    setMessage("已新建导图");
  }

  function importMarkdown(file: File): void {
    file.text()
      .then((text) => {
        const parsed = parseMarkdown(text, file.name);
        replaceDocument({
          fileName: file.name,
          markdown: text,
          root: parsed.root,
          localModifiedAt: new Date().toISOString(),
          lastSavedMarkdown: text,
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
      setDocumentState((current) => ({
        ...current,
        root: parsed.root,
        warnings: parsed.warnings,
      }));
      setSelectedIds([parsed.root.id]);
    }
    setMode(nextMode);
  }

  function updateRoot(nextRoot: DocumentState["root"]): void {
    const markdown = serializeMarkdown(nextRoot);
    setDocumentState((current) => markDirty(current, markdown, nextRoot, current.warnings));
  }

  function addChild(parentId: string): void {
    const nodeId = createNodeId("node");
    updateRoot(addChildNode(documentState.root, parentId, "新节点", nodeId));
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

  function moveNode(nodeId: string, newParentId: string, index: number): void {
    const nextRoot = moveSubtree(documentState.root, nodeId, newParentId, index);
    if (nextRoot === documentState.root) {
      return;
    }

    updateRoot(nextRoot);
    setSelectedIds([nodeId]);
    setMessage("已移动节点并自动排版");
  }

  function syncNow(): void {
    if (!webDavConfig.serverUrl) {
      setSettingsOpen(true);
      setMessage("请先配置 WebDAV 服务器");
      return;
    }
    setDocumentState((current) => ({ ...current, saveStatus: "syncing", syncError: undefined }));
    synchronizeDocument(documentState, webDavConfig)
      .then((result) => {
        const parsed = parseMarkdown(result.document.markdown, result.document.fileName);
        setDocumentState({
          ...result.document,
          root: parsed.root,
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
        setDocumentState((current) => ({ ...current, saveStatus: "syncFailed", syncError: text }));
      });
  }

  return (
    <div className="app">
      <Toolbar
        mode={mode}
        status={documentState.saveStatus}
        onNew={newDocument}
        onImport={() => fileInputRef.current?.click()}
        onExportMarkdown={() => {
          downloadText(documentState.fileName, documentState.markdown);
          setDocumentState((current) => ({ ...current, lastSavedMarkdown: current.markdown, saveStatus: "saved" }));
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
        {mode === "markdown" ? (
          <MarkdownEditor
            value={documentState.markdown}
            onChange={(markdown) => setDocumentState((current) => markDirty(current, markdown))}
          />
        ) : (
          <MindMapCanvas
            root={documentState.root}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelect={(nodeId) => setSelectedIds([nodeId])}
            onSelectMany={setSelectedIds}
            onAddChild={addChild}
            onAddSibling={addSibling}
            onEditTitle={(nodeId, title) => updateRoot(updateNodeTitle(documentState.root, nodeId, title))}
            onEditNote={(nodeId, note) => updateRoot(updateNodeNote(documentState.root, nodeId, note))}
            onDeleteSelection={deleteSelection}
            onMoveSubtree={moveNode}
          />
        )}
      </main>
      <StatusBar document={documentState} message={message} />
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
