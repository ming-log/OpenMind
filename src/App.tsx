import { useEffect, useMemo, useRef, useState } from "react";
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
import { downloadRemoteMarkdown, joinWebDavPath, listRemoteMarkdownFiles, pullRemoteDocument, synchronizeDocument, testWebDavConnection, uploadRemoteText, type RemoteMarkdownFile } from "./domain/sync";
import { getThemePreset, THEME_PRESETS } from "./domain/themes";
import { addChildNode, addParentNode, addSiblingNode, collectSubtreeIds, deleteNodes, moveSubtree, updateNodeNote, updateNodeSize, updateNodeTitle } from "./domain/tree";
import type { BackupEntry, DocumentState, GroupFrame, PersistedState, SharePublication, ThemeId, WebDavConfig } from "./domain/types";

type Mode = "map" | "markdown";
type AppRoute =
  | { kind: "editor" }
  | { kind: "localShare"; documentId: string }
  | { kind: "snapshotShare"; payload: string }
  | { kind: "remoteShare"; payload: string };
type TaskDeleteTarget = {
  documentId: string;
  title: string;
};
const DEFAULT_PLACEHOLDER_FILE_NAME = "OpenMind.md";
const DEFAULT_PLACEHOLDER_MARKDOWN = "# OpenMind\n";

interface SharePayload {
  version: 1;
  createdAt: string;
  updatedAt?: string;
  themeId: ThemeId;
  document: DocumentState;
}

type RemoteShareTarget =
  | { version: 1; provider?: "direct"; url: string }
  | { version: 1; provider: "openlist"; apiUrl: string; path: string; password?: string };
type RemoteShareTargetJson = {
  version?: unknown;
  provider?: unknown;
  url?: unknown;
  apiUrl?: unknown;
  path?: unknown;
  password?: unknown;
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

function isDefaultPlaceholderDocument(document: DocumentState): boolean {
  return (
    document.fileName === DEFAULT_PLACEHOLDER_FILE_NAME
    && document.markdown === DEFAULT_PLACEHOLDER_MARKDOWN
    && !document.lastSyncedAt
    && document.saveStatus === "saved"
  );
}

function webDavConfigPullKey(config: WebDavConfig): string {
  return [
    config.serverUrl.trim(),
    config.remoteDir.trim(),
    config.username.trim(),
    config.password ?? "",
  ].join("\n");
}

function applyTheme(themeId: ThemeId): void {
  const theme = getThemePreset(themeId);
  document.documentElement.dataset.theme = theme.id;
  Object.entries(theme.cssVars).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }

  return btoa(chunks.join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - value.length % 4) % 4)}`;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createSharePayload(documentState: DocumentState, themeId: ThemeId): string {
  return encodeBase64Url(createSharePayloadText(documentState, themeId));
}

export function createSharePayloadText(documentState: DocumentState, themeId: ThemeId): string {
  const now = new Date().toISOString();
  const payload: SharePayload = {
    version: 1,
    createdAt: now,
    updatedAt: now,
    themeId,
    document: {
      ...documentState,
      groupFrames: documentState.groupFrames ?? [],
    },
  };

  return JSON.stringify(payload);
}

export function parseSharePayloadJson(jsonText: string): SharePayload | undefined {
  try {
    const payload = JSON.parse(jsonText) as Partial<SharePayload>;
    if (payload.version !== 1 || !payload.document?.root || !payload.themeId) {
      return undefined;
    }

    return {
      version: 1,
      createdAt: payload.createdAt ?? "",
      updatedAt: payload.updatedAt,
      themeId: getThemePreset(payload.themeId).id,
      document: {
        ...payload.document,
        groupFrames: payload.document.groupFrames ?? [],
      },
    };
  } catch {
    return undefined;
  }
}

export function decodeSharePayload(payloadText: string): SharePayload | undefined {
  try {
    return parseSharePayloadJson(decodeBase64Url(payloadText));
  } catch {
    return undefined;
  }
}

export function createRemoteSharePayload(target: RemoteShareTarget): string {
  return encodeBase64Url(JSON.stringify(target));
}

export function decodeRemoteShareTarget(payloadText: string): RemoteShareTarget | undefined {
  try {
    const target = JSON.parse(decodeBase64Url(payloadText)) as RemoteShareTargetJson;
    if (target.version !== 1) {
      return undefined;
    }

    if (target.provider === "openlist") {
      if (typeof target.apiUrl !== "string" || typeof target.path !== "string") {
        return undefined;
      }
      const apiUrl = new URL(target.apiUrl);
      if (apiUrl.protocol !== "http:" && apiUrl.protocol !== "https:") {
        return undefined;
      }
      const path = target.path.startsWith("/") ? target.path : `/${target.path}`;
      return {
        version: 1,
        provider: "openlist",
        apiUrl: apiUrl.toString(),
        path,
        password: typeof target.password === "string" ? target.password : "",
      };
    }

    if (typeof target.url !== "string") {
      return undefined;
    }
    const url = new URL(target.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return { version: 1, provider: "direct", url: url.toString() };
  } catch {
    return undefined;
  }
}

export function parseAppRoute(hash = window.location.hash): AppRoute {
  const remoteMatch = /^#\/share-remote\/(.+)$/.exec(hash);
  if (remoteMatch) {
    return { kind: "remoteShare", payload: remoteMatch[1] };
  }

  const snapshotMatch = /^#\/share-data\/(.+)$/.exec(hash);
  if (snapshotMatch) {
    return { kind: "snapshotShare", payload: snapshotMatch[1] };
  }

  const localMatch = /^#\/share\/(.+)$/.exec(hash);
  if (!localMatch) {
    return { kind: "editor" };
  }

  try {
    return { kind: "localShare", documentId: decodeURIComponent(localMatch[1]) };
  } catch {
    return { kind: "editor" };
  }
}

export function createShareUrl(currentHref: string, documentState: DocumentState, themeId: ThemeId): string {
  const url = new URL(currentHref);
  url.search = "";
  url.hash = `/share-data/${createSharePayload(documentState, themeId)}`;
  return url.toString();
}

export function createRemoteShareUrl(currentHref: string, target: RemoteShareTarget): string {
  const url = new URL(currentHref);
  url.search = "";
  url.hash = `/share-remote/${createRemoteSharePayload(target)}`;
  return url.toString();
}

function allDocuments(state: PersistedState): DocumentState[] {
  return state.documents?.length ? state.documents : [state.document];
}

function findSharedDocument(state: PersistedState, documentId: string): DocumentState | undefined {
  return allDocuments(state).find((document) => document.id === documentId);
}

function containsNode(root: DocumentState["root"], nodeId: string): boolean {
  if (root.id === nodeId) {
    return true;
  }
  return root.children.some((child) => containsNode(child, nodeId));
}

function shareFileName(document: DocumentState): string {
  return `openmind-share-${document.id ?? createNodeId("share")}.json`;
}

export function createPublicShareRemoteUrl(config: WebDavConfig, fileName: string): string {
  const publicBase = config.publicShareBaseUrl?.trim();
  const rawUrl = publicBase
    ? `${publicBase.replace(/\/+$/, "")}/${encodeURIComponent(fileName)}`
    : joinWebDavPath(config.serverUrl, config.remoteDir, fileName);
  const url = new URL(rawUrl);
  url.username = "";
  url.password = "";
  return url.toString();
}

function createOpenListApiUrl(config: WebDavConfig): string {
  const publicBase = config.publicShareBaseUrl?.trim();
  const fallbackBase = publicBase ? "" : new URL(config.serverUrl).origin;
  const url = new URL(publicBase || fallbackBase);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("OpenList 访客分享读取地址无效。");
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  const cleanPath = url.pathname.replace(/\/+$/, "");
  url.pathname = /\/api\/fs\/get$/i.test(cleanPath) ? cleanPath : "/api/fs/get";
  return url.toString();
}

export function createOpenListSharePath(remoteDir: string, fileName: string): string {
  const dir = remoteDir.trim().replace(/^\/+|\/+$/g, "");
  const safeFileName = fileName.replace(/^\/+/, "");
  return `/${[dir, safeFileName].filter(Boolean).join("/")}`;
}

export function createRemoteShareTarget(config: WebDavConfig, fileName: string): RemoteShareTarget {
  if (config.publicShareProvider === "openlist") {
    return {
      version: 1,
      provider: "openlist",
      apiUrl: createOpenListApiUrl(config),
      path: createOpenListSharePath(config.remoteDir, fileName),
      password: "",
    };
  }

  return {
    version: 1,
    provider: "direct",
    url: createPublicShareRemoteUrl(config, fileName),
  };
}

function remoteShareTargetDisplayUrl(target: RemoteShareTarget): string {
  return target.provider === "openlist" ? `${target.apiUrl}#${target.path}` : target.url;
}

async function fetchDirectShareText(remoteUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(remoteUrl, { cache: "no-store" });
  } catch {
    throw new Error("访客分享地址无法读取，请确认公开地址允许浏览器跨域 GET。");
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("访客分享地址仍需要登录，请开启访客/公开读取，或在设置里填写公开分享读取地址。");
  }
  if (!response.ok) {
    throw new Error(`访客分享地址读取失败：${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchOpenListShareText(target: Extract<RemoteShareTarget, { provider: "openlist" }>): Promise<string> {
  let response: Response;
  try {
    response = await fetch(target.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: target.path, password: target.password ?? "" }),
      cache: "no-store",
    });
  } catch {
    throw new Error("OpenList 访客接口无法读取，请确认 /api/fs/get 允许浏览器跨域 POST。");
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("OpenList 访客接口仍需要登录，请开启访客/公开读取。");
  }
  if (!response.ok) {
    throw new Error(`OpenList 访客接口读取失败：${response.status} ${response.statusText}`);
  }

  let result: { code?: number; message?: string; data?: { raw_url?: unknown } };
  try {
    result = await response.json();
  } catch {
    throw new Error("OpenList 访客接口响应不是 JSON。");
  }

  if (typeof result.code === "number" && result.code !== 200) {
    throw new Error(`OpenList 访客接口返回失败：${result.message || result.code}`);
  }

  const rawUrl = result.data?.raw_url;
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("OpenList 响应缺少 raw_url。");
  }

  let readableUrl: string;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    readableUrl = url.toString();
  } catch {
    throw new Error("OpenList 响应里的 raw_url 无效。");
  }

  try {
    return await fetchDirectShareText(readableUrl);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "读取 OpenList raw_url 失败";
    throw new Error(message.replace("访客分享地址", "OpenList raw_url"));
  }
}

async function fetchRemoteShareText(target: RemoteShareTarget): Promise<string> {
  if (target.provider === "openlist") {
    return fetchOpenListShareText(target);
  }
  return fetchDirectShareText(target.url);
}

export async function loadRemoteSharePayload(target: RemoteShareTarget): Promise<SharePayload> {
  const payload = parseSharePayloadJson(await fetchRemoteShareText(target));
  if (!payload) {
    throw new Error("分享数据格式无效");
  }
  return payload;
}

export async function verifyPublicShareReadable(target: RemoteShareTarget): Promise<void> {
  await loadRemoteSharePayload(target);
}

function sharePublicationForDocument(publications: SharePublication[], document: DocumentState, config: WebDavConfig): SharePublication {
  const documentId = document.id ?? "";
  const existing = publications.find((publication) => publication.documentId === documentId);
  if (existing) {
    const target = createRemoteShareTarget(config, existing.fileName);
    return {
      ...existing,
      remoteUrl: remoteShareTargetDisplayUrl(target),
    };
  }

  const fileName = shareFileName(document);
  const target = createRemoteShareTarget(config, fileName);
  return {
    documentId,
    fileName,
    remoteUrl: remoteShareTargetDisplayUrl(target),
  };
}

async function publishShareDocument(document: DocumentState, themeId: ThemeId, config: WebDavConfig, fileName: string): Promise<void> {
  await uploadRemoteText(config, fileName, createSharePayloadText(document, themeId), "application/json;charset=utf-8");
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute());

  useEffect(() => {
    function hashchange(): void {
      setRoute(parseAppRoute());
    }

    window.addEventListener("hashchange", hashchange);
    return () => window.removeEventListener("hashchange", hashchange);
  }, []);

  return route.kind === "editor" ? <EditorApp /> : <SharePage route={route} />;
}

function EditorApp() {
  const initial = loadPersistedState();
  const initialDocuments = (initial.documents?.length ? initial.documents : [initial.document]).map(ensureDocumentId);
  const initialActiveDocument = initialDocuments.find((document) => document.id === initial.activeDocumentId) ?? initialDocuments[0];
  const [documents, setDocuments] = useState<DocumentState[]>(initialDocuments);
  const [activeDocumentId, setActiveDocumentId] = useState(initialActiveDocument.id ?? "");
  const [documentState, setDocumentState] = useState<DocumentState>(initialActiveDocument);
  const [backups, setBackups] = useState<BackupEntry[]>(initial.backups);
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>(initial.webDavConfig);
  const [themeId, setThemeId] = useState<ThemeId>(initial.themeId);
  const [sharePublications, setSharePublications] = useState<SharePublication[]>(initial.sharePublications ?? []);
  const [mode, setMode] = useState<Mode>("map");
  const [selectedIds, setSelectedIds] = useState<string[]>([initialActiveDocument.root.id]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskDeleteTarget, setTaskDeleteTarget] = useState<TaskDeleteTarget | null>(null);
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoPullStartedRef = useRef(false);
  const remoteHistoryPullKeyRef = useRef("");
  const undoStacksRef = useRef<Record<string, DocumentState[]>>({});
  const sharePublishTimersRef = useRef<Record<string, number>>({});
  const selectedId = selectedIds[0];

  useEffect(() => {
    savePersistedState(window.localStorage, {
      document: documentState,
      documents,
      activeDocumentId,
      backups,
      webDavConfig,
      themeId,
      sharePublications,
    });
  }, [activeDocumentId, backups, documentState, documents, themeId, webDavConfig, sharePublications]);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    return () => {
      Object.values(sharePublishTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  useEffect(() => {
    if (autoPullStartedRef.current || !webDavConfig.serverUrl.trim()) {
      return;
    }

    autoPullStartedRef.current = true;
    pullRemoteHistory(webDavConfig, {
      automatic: true,
      fallbackDocument: documentState,
      skipIfAlreadyPulled: true,
    }).catch((error: unknown) => {
      const text = error instanceof TypeError
        ? "拉取历史失败：网络或 CORS 不可用，请确认 WebDAV 服务允许浏览器跨域访问。"
        : error instanceof Error ? error.message : "拉取历史失败";
      setMessage(text);
    });
  }, []);

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
    queueSharePublish(ensured);
  }

  function queueSharePublish(document: DocumentState): void {
    const documentId = document.id;
    if (!documentId || !webDavConfig.serverUrl) {
      return;
    }

    const publication = sharePublications.find((entry) => entry.documentId === documentId);
    if (!publication) {
      return;
    }

    const existingTimer = sharePublishTimersRef.current[documentId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    sharePublishTimersRef.current[documentId] = window.setTimeout(() => {
      delete sharePublishTimersRef.current[documentId];
      publishShareDocument(document, themeId, webDavConfig, publication.fileName)
        .then(() => {
          setSharePublications((current) => current.map((entry) => (
            entry.documentId === documentId
              ? { ...entry, updatedAt: new Date().toISOString(), error: undefined }
              : entry
          )));
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "分享发布失败";
          setSharePublications((current) => current.map((entry) => (
            entry.documentId === documentId ? { ...entry, error: message } : entry
          )));
          setMessage(`分享发布失败：${message}`);
        });
    }, 800);
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

  function updateMarkdown(markdown: string): void {
    const parsed = parseMarkdown(markdown, documentState.fileName);
    commitDocument(markDirty(documentState, markdown, parsed.root, parsed.warnings));
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

  function addParent(nodeId: string): void {
    if (nodeId === documentState.root.id) {
      setMessage("根节点不能添加上级节点");
      return;
    }

    const nextNodeId = createNodeId("node");
    updateRoot(addParentNode(documentState.root, nodeId, "新节点", nextNodeId));
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
    if (!uniqueIds.length) {
      setMessage("请先选择节点");
      return;
    }

    const frameNodeIds = collectSubtreeIds(documentState.root, uniqueIds);
    const sortedFrameNodeIds = [...frameNodeIds].sort();
    const sameFrameSet = (frame: GroupFrame) => {
      const sortedExistingIds = [...frame.nodeIds].sort();
      return sortedExistingIds.length === sortedFrameNodeIds.length
        && sortedExistingIds.every((nodeId, index) => nodeId === sortedFrameNodeIds[index]);
    };
    const hasExistingFrame = (documentState.groupFrames ?? []).some(sameFrameSet);

    if (hasExistingFrame) {
      const groupFrames = (documentState.groupFrames ?? []).filter((frame) => !sameFrameSet(frame));
      commitUndoable(markDirty(documentState, documentState.markdown, documentState.root, documentState.warnings, groupFrames));
      setMessage("已取消外框");
      return;
    }

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

  function openSharePage(): void {
    if (!webDavConfig.serverUrl) {
      setSettingsOpen(true);
      setMessage("动态分享需要先配置 WebDAV，并确保分享文件可被对方浏览器公开读取。");
      return;
    }

    const ensured = ensureDocumentId(documentState);
    let publication: SharePublication;
    try {
      publication = sharePublicationForDocument(sharePublications, ensured, webDavConfig);
    } catch {
      setSettingsOpen(true);
      setMessage("WebDAV 地址无效，无法生成动态分享链接。");
      return;
    }
    const remoteTarget = createRemoteShareTarget(webDavConfig, publication.fileName);
    const shareUrl = createRemoteShareUrl(window.location.href, remoteTarget);
    const nextPublications = [
      ...sharePublications.filter((entry) => entry.documentId !== publication.documentId),
      { ...publication, updatedAt: new Date().toISOString(), error: undefined },
    ];
    setSharePublications(nextPublications);

    savePersistedState(window.localStorage, {
      document: ensured,
      documents,
      activeDocumentId,
      backups,
      webDavConfig,
      themeId,
      sharePublications: nextPublications,
    });

    window.open(shareUrl, "_blank", "noopener,noreferrer");

    publishShareDocument(ensured, themeId, webDavConfig, publication.fileName)
      .then(() => verifyPublicShareReadable(remoteTarget))
      .then(() => {
        setSharePublications((current) => current.map((entry) => (
          entry.documentId === publication.documentId
            ? { ...entry, updatedAt: new Date().toISOString(), error: undefined }
            : entry
        )));
        setMessage("动态只读分享已发布，链接已复制。后续修改会自动更新同一个地址。");
      })
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : "发布失败";
        setSharePublications((current) => current.map((entry) => (
          entry.documentId === publication.documentId ? { ...entry, error: text } : entry
        )));
        setMessage(`动态分享发布失败：${text}`);
      });

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => setMessage("动态只读分享已打开，链接已复制，正在发布最新内容"))
        .catch(() => setMessage("动态只读分享已打开，正在发布最新内容"));
      return;
    }

    setMessage("动态只读分享已打开，正在发布最新内容");
  }

  function createDocumentFromRemoteFile(file: RemoteMarkdownFile, markdown: string, now: string): DocumentState {
    const existing = documents.find((document) => document.fileName === file.fileName);
    const parsed = parseMarkdown(markdown, file.fileName);
    const normalizedMarkdown = parsed.warnings.includes(MULTIPLE_H1_NORMALIZED_WARNING)
      ? serializeMarkdown(parsed.root)
      : markdown;

    return ensureDocumentId({
      id: existing?.id ?? createNodeId("task"),
      fileName: file.fileName,
      markdown: normalizedMarkdown,
      root: parsed.root,
      groupFrames: existing?.groupFrames ?? [],
      localModifiedAt: file.modifiedAt ?? now,
      lastSyncedAt: now,
      lastSavedMarkdown: normalizedMarkdown,
      saveStatus: "saved",
      warnings: parsed.warnings,
      syncError: undefined,
    });
  }

  async function pullRemoteHistory(
    config: WebDavConfig,
    options: { automatic?: boolean; fallbackDocument?: DocumentState; skipIfAlreadyPulled?: boolean } = {},
  ): Promise<number> {
    if (!config.serverUrl.trim()) {
      return 0;
    }

    const pullKey = webDavConfigPullKey(config);
    if (options.skipIfAlreadyPulled && remoteHistoryPullKeyRef.current === pullKey) {
      return 0;
    }
    remoteHistoryPullKeyRef.current = pullKey;

    if (!options.automatic) {
      setMessage("正在从 WebDAV 拉取历史思维导图...");
    }

    const remoteFiles = await listRemoteMarkdownFiles(config);
    if (!remoteFiles.length) {
      const fallbackDocument = options.fallbackDocument ?? documentState;
      runWebDavSync(fallbackDocument, config, { mode: "pull", promptForConfig: false });
      return 0;
    }

    const now = new Date().toISOString();
    const remoteDocuments = await Promise.all(remoteFiles.map(async (file) => (
      createDocumentFromRemoteFile(file, await downloadRemoteMarkdown(config, file.fileName), now)
    )));
    const remoteFileNames = new Set(remoteDocuments.map((document) => document.fileName));
    const localDocumentsToKeep = documents.filter((document) => (
      !remoteFileNames.has(document.fileName) && !isDefaultPlaceholderDocument(document)
    ));
    const nextDocuments = [...remoteDocuments, ...localDocumentsToKeep];
    const activeDocument = nextDocuments[0];

    setDocuments(nextDocuments);
    setDocumentState(activeDocument);
    setActiveDocumentId(activeDocument.id ?? "");
    setSelectedIds([activeDocument.root.id]);
    setMode("map");
    setMessage(`已从 WebDAV 拉取 ${remoteDocuments.length} 个历史思维导图`);
    return remoteDocuments.length;
  }

  function runWebDavSync(
    sourceDocument: DocumentState,
    config: WebDavConfig,
    options: { mode?: "sync" | "pull"; promptForConfig?: boolean } = {},
  ): void {
    const promptForConfig = options.promptForConfig ?? true;
    if (!config.serverUrl.trim()) {
      if (promptForConfig) {
        setSettingsOpen(true);
        setMessage("请先配置 WebDAV 服务器");
      }
      return;
    }

    const syncTask = options.mode === "pull"
      ? pullRemoteDocument(sourceDocument, config)
      : synchronizeDocument(sourceDocument, config);

    commitDocument({ ...sourceDocument, saveStatus: "syncing", syncError: undefined });
    syncTask
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
        commitDocument({ ...sourceDocument, saveStatus: "syncFailed", syncError: text });
        setMessage(text);
      });
  }

  function syncNow(): void {
    runWebDavSync(documentState, webDavConfig);
  }

  return (
    <div className={`app ${focusMode ? "focus-mode" : ""}`} data-theme={themeId}>
      <Toolbar
        mode={mode}
        status={documentState.saveStatus}
        onNew={newDocument}
        onImport={() => fileInputRef.current?.click()}
        onExportMarkdown={() => {
          downloadText(documentState.fileName, documentState.markdown);
          commitDocument({ ...documentState, lastSavedMarkdown: documentState.markdown, saveStatus: "saved" });
        }}
        onExportPng={() => exportTreeAsPng(documentState.root, documentState.fileName, themeId)}
        onShare={openSharePage}
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
            onChange={updateMarkdown}
          />
        ) : (
          <MindMapCanvas
            key={activeDocumentId}
            root={documentState.root}
            groupFrames={documentState.groupFrames ?? []}
            selectedId={selectedId}
            selectedIds={selectedIds}
            themeId={themeId}
            themes={THEME_PRESETS}
            onSelect={(nodeId) => setSelectedIds([nodeId])}
            onSelectMany={setSelectedIds}
            onClearSelection={() => setSelectedIds([])}
            onThemeChange={setThemeId}
            onAddChild={addChild}
            onAddSibling={addSibling}
            onAddParent={addParent}
            onEditTitle={(nodeId, title) => updateRoot(updateNodeTitle(documentState.root, nodeId, title))}
            onEditNote={(nodeId, note) => updateRoot(updateNodeNote(documentState.root, nodeId, note))}
            onResizeNode={(nodeId, size) => updateRoot(updateNodeSize(documentState.root, nodeId, size))}
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
          onClose={() => {
            setSettingsOpen(false);
            pullRemoteHistory(webDavConfig, {
              automatic: true,
              fallbackDocument: documentState,
              skipIfAlreadyPulled: true,
            }).catch((error: unknown) => {
              const text = error instanceof TypeError
                ? "拉取历史失败：网络或 CORS 不可用，请确认 WebDAV 服务允许浏览器跨域访问。"
                : error instanceof Error ? error.message : "拉取历史失败";
              setMessage(text);
            });
          }}
          onConfigChange={setWebDavConfig}
          onTestConnection={() => {
            setTestMessage("测试中...");
            testWebDavConnection(webDavConfig)
              .then(async (text) => {
                setTestMessage(`${text} 正在拉取历史思维导图...`);
                const pulledCount = await pullRemoteHistory(webDavConfig, { fallbackDocument: documentState });
                setTestMessage(pulledCount
                  ? `连接成功，已拉取 ${pulledCount} 个历史思维导图。`
                  : "连接成功，未发现目录里的历史 Markdown，已尝试拉取当前文件。");
              })
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

type ShareRoute =
  | Extract<AppRoute, { kind: "localShare" }>
  | Extract<AppRoute, { kind: "snapshotShare" }>
  | Extract<AppRoute, { kind: "remoteShare" }>;

interface SharePageProps {
  route: ShareRoute;
}

function BrandLogo() {
  return <img className="brand-logo" src={`${import.meta.env.BASE_URL}openmind-logo.png`} alt="" />;
}

function SharePage(props: SharePageProps) {
  const [persisted, setPersisted] = useState<PersistedState>(() => loadPersistedState(window.localStorage));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [remotePayload, setRemotePayload] = useState<SharePayload | undefined>();
  const [remoteError, setRemoteError] = useState("");
  const snapshotPayload = useMemo(() => (
    props.route.kind === "snapshotShare" ? decodeSharePayload(props.route.payload) : undefined
  ), [props.route]);
  const remoteTarget = useMemo(() => (
    props.route.kind === "remoteShare" ? decodeRemoteShareTarget(props.route.payload) : undefined
  ), [props.route]);
  const sharedDocument = props.route.kind === "snapshotShare"
    ? snapshotPayload?.document
    : props.route.kind === "remoteShare"
      ? remotePayload?.document
      : findSharedDocument(persisted, props.route.documentId);
  const themeId = getThemePreset(
    props.route.kind === "snapshotShare"
      ? snapshotPayload?.themeId
      : props.route.kind === "remoteShare" ? remotePayload?.themeId : persisted.themeId,
  ).id;
  const visibleSelectedIds = selectedIds.length ? selectedIds : sharedDocument ? [sharedDocument.root.id] : [];
  const shareModeLabel = props.route.kind === "snapshotShare"
    ? "只读分享快照"
    : props.route.kind === "remoteShare"
      ? "动态只读分享 · 自动读取发布更新"
      : "只读本机预览 · 自动同步当前浏览器修改";

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    if (props.route.kind !== "localShare") {
      return undefined;
    }

    function refreshSharedState(): void {
      setPersisted(loadPersistedState(window.localStorage));
    }

    window.addEventListener("storage", refreshSharedState);
    window.addEventListener("focus", refreshSharedState);
    const refreshTimer = window.setInterval(refreshSharedState, 1000);
    refreshSharedState();

    return () => {
      window.removeEventListener("storage", refreshSharedState);
      window.removeEventListener("focus", refreshSharedState);
      window.clearInterval(refreshTimer);
    };
  }, [props.route]);

  useEffect(() => {
    if (props.route.kind !== "remoteShare") {
      return undefined;
    }
    if (!remoteTarget) {
      setRemoteError("分享地址无效，请让分享者重新生成链接。");
      return undefined;
    }

    const target = remoteTarget;
    let cancelled = false;
    async function refreshRemoteShare(): Promise<void> {
      try {
        const payload = await loadRemoteSharePayload(target);
        if (!cancelled) {
          setRemotePayload(payload);
          setRemoteError("");
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setRemoteError(error instanceof Error ? error.message : "读取分享内容失败");
        }
      }
    }

    refreshRemoteShare();
    const refreshTimer = window.setInterval(refreshRemoteShare, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [props.route, remoteTarget]);

  useEffect(() => {
    if (!sharedDocument) {
      if (selectedIds.length) {
        setSelectedIds([]);
      }
      return;
    }

    const selectedStillExists = selectedIds.some((nodeId) => containsNode(sharedDocument.root, nodeId));
    if (!selectedStillExists) {
      setSelectedIds([sharedDocument.root.id]);
    }
  }, [selectedIds, sharedDocument]);

  if (!sharedDocument) {
    const missingMessage = props.route.kind === "snapshotShare"
      ? "分享链接里的数据无法读取，请让分享者重新生成链接。"
      : props.route.kind === "remoteShare"
        ? remoteError || "正在读取远端分享内容..."
        : "这个本机预览只在生成它的浏览器里可用；跨设备请使用动态分享地址。";

    return (
      <div className="share-page" data-theme={themeId}>
        <header className="share-header">
          <div className="share-brand">
            <BrandLogo />
            <div>
              <strong>OpenMind</strong>
              <span>{shareModeLabel}</span>
            </div>
          </div>
          <button onClick={() => { window.location.hash = ""; }} type="button">返回编辑</button>
        </header>
        <main className="share-empty">
          <strong>没有找到这个分享任务</strong>
          <span>{missingMessage}</span>
        </main>
      </div>
    );
  }

  return (
    <div className="share-page" data-theme={themeId}>
      <header className="share-header">
        <div className="share-brand">
          <BrandLogo />
          <div>
            <strong>{taskTitle(sharedDocument)}</strong>
            <span>{shareModeLabel}</span>
          </div>
        </div>
        <button onClick={() => { window.location.hash = ""; }} type="button">返回编辑</button>
      </header>
      <main className="share-map">
        <MindMapCanvas
          key={sharedDocument.id ?? sharedDocument.localModifiedAt}
          readOnly
          root={sharedDocument.root}
          groupFrames={sharedDocument.groupFrames ?? []}
          selectedId={visibleSelectedIds[0]}
          selectedIds={visibleSelectedIds}
          themeId={themeId}
          themes={THEME_PRESETS}
          onSelect={(nodeId) => setSelectedIds([nodeId])}
          onSelectMany={setSelectedIds}
          onClearSelection={() => setSelectedIds([])}
          onThemeChange={() => undefined}
          onAddChild={() => undefined}
          onAddSibling={() => undefined}
          onAddParent={() => undefined}
          onEditTitle={() => undefined}
          onEditNote={() => undefined}
          onResizeNode={() => undefined}
          onDeleteSelection={() => undefined}
          onMoveSubtree={() => undefined}
          onCreateGroupFrame={() => undefined}
          onUpdateGroupFrameNote={() => undefined}
          onDeleteGroupFrame={() => undefined}
          focusMode={false}
          onFocusModeChange={() => undefined}
          shortcutsDisabled
        />
      </main>
    </div>
  );
}
