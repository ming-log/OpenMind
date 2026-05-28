import type { BackupEntry, DocumentState, WebDavConfig } from "./types";

export type SyncDirection = "upload" | "download" | "noop";

export interface RemoteMarkdownFile {
  fileName: string;
  modifiedAt?: string;
}

export interface SyncDecisionInput {
  localModifiedAt: string;
  remoteModifiedAt?: string;
}

export function decideSyncDirection(input: SyncDecisionInput): SyncDirection {
  if (!input.remoteModifiedAt) {
    return "upload";
  }
  const local = new Date(input.localModifiedAt).getTime();
  const remote = new Date(input.remoteModifiedAt).getTime();
  if (Number.isNaN(remote) || local > remote) {
    return "upload";
  }
  if (remote > local) {
    return "download";
  }
  return "noop";
}

export function joinWebDavPath(serverUrl: string, remoteDir: string, fileName: string): string {
  const base = serverUrl.replace(/\/+$/, "");
  const dir = remoteDir
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const encodedFileName = encodeURIComponent(fileName);
  return [base, dir, encodedFileName].filter(Boolean).join("/");
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function readWebDavTag(block: string, tagName: string): string | undefined {
  const match = new RegExp(`<[^:>]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^:>]*:?${tagName}>`, "i").exec(block);
  return match?.[1] ? decodeXmlText(match[1].trim()) : undefined;
}

function fileNameFromHref(href: string): string {
  const cleanHref = href.split(/[?#]/)[0].replace(/\/+$/g, "");
  const fileName = cleanHref.slice(cleanHref.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

export function parseWebDavMarkdownFileList(multistatusXml: string): RemoteMarkdownFile[] {
  const files: RemoteMarkdownFile[] = [];
  const seen = new Set<string>();
  const responses = multistatusXml.matchAll(/<[^:>]*:?response\b[^>]*>([\s\S]*?)<\/[^:>]*:?response>/gi);

  for (const response of responses) {
    const block = response[1];
    const href = readWebDavTag(block, "href");
    if (!href) {
      continue;
    }

    const fileName = fileNameFromHref(href);
    if (!/\.(md|markdown)$/i.test(fileName) || seen.has(fileName)) {
      continue;
    }

    const rawModifiedAt = readWebDavTag(block, "getlastmodified");
    const modifiedTime = rawModifiedAt ? new Date(rawModifiedAt).getTime() : NaN;
    files.push({
      fileName,
      modifiedAt: Number.isNaN(modifiedTime) ? undefined : new Date(modifiedTime).toISOString(),
    });
    seen.add(fileName);
  }

  return files.sort((left, right) => {
    const leftTime = left.modifiedAt ? new Date(left.modifiedAt).getTime() : 0;
    const rightTime = right.modifiedAt ? new Date(right.modifiedAt).getTime() : 0;
    return rightTime - leftTime || left.fileName.localeCompare(right.fileName);
  });
}

export function makeBasicAuthHeader(username: string, password: string): string {
  const raw = `${username}:${password}`;
  return `Basic ${base64EncodeUtf8(raw)}`;
}

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function authHeaders(config: WebDavConfig): HeadersInit {
  if (!config.username || !config.password) {
    return {};
  }
  return { Authorization: makeBasicAuthHeader(config.username, config.password) };
}

export async function testWebDavConnection(config: WebDavConfig): Promise<string> {
  const response = await fetch(config.serverUrl, {
    method: "PROPFIND",
    headers: {
      ...authHeaders(config),
      Depth: "0",
    },
  });
  if (!response.ok) {
    throw new Error(`WebDAV connection failed: ${response.status} ${response.statusText}`);
  }
  return "Connection succeeded.";
}

export async function listRemoteMarkdownFiles(config: WebDavConfig): Promise<RemoteMarkdownFile[]> {
  const response = await fetch(joinWebDavPath(config.serverUrl, config.remoteDir, ""), {
    method: "PROPFIND",
    headers: {
      ...authHeaders(config),
      Depth: "1",
    },
  });

  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Unable to list remote files: ${response.status} ${response.statusText}`);
  }

  return parseWebDavMarkdownFileList(await response.text());
}

export async function getRemoteMetadata(config: WebDavConfig, fileName: string): Promise<{ modifiedAt?: string }> {
  const response = await fetch(joinWebDavPath(config.serverUrl, config.remoteDir, fileName), {
    method: "PROPFIND",
    headers: {
      ...authHeaders(config),
      Depth: "0",
    },
  });

  if (response.status === 404) {
    return {};
  }
  if (!response.ok) {
    throw new Error(`Unable to read remote metadata: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const match = /<[^:>]*:?getlastmodified[^>]*>(.*?)<\/[^:>]*:?getlastmodified>/i.exec(text);
  return { modifiedAt: match?.[1] ? new Date(match[1]).toISOString() : undefined };
}

export async function downloadRemoteMarkdown(config: WebDavConfig, fileName: string): Promise<string> {
  const response = await fetch(joinWebDavPath(config.serverUrl, config.remoteDir, fileName), {
    method: "GET",
    headers: authHeaders(config),
  });
  if (!response.ok) {
    throw new Error(`Unable to download remote file: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function uploadRemoteMarkdown(config: WebDavConfig, fileName: string, markdown: string): Promise<void> {
  return uploadRemoteText(config, fileName, markdown, "text/markdown;charset=utf-8");
}

export async function uploadRemoteText(config: WebDavConfig, fileName: string, text: string, contentType: string): Promise<void> {
  const response = await fetch(joinWebDavPath(config.serverUrl, config.remoteDir, fileName), {
    method: "PUT",
    headers: {
      ...authHeaders(config),
      "Content-Type": contentType,
    },
    body: text,
  });
  if (!response.ok) {
    throw new Error(`Unable to upload remote file: ${response.status} ${response.statusText}`);
  }
}

export function createBackup(fileName: string, source: BackupEntry["source"], markdown: string): BackupEntry {
  const createdAt = new Date().toISOString();
  return {
    id: `${source}-${createdAt}-${Math.random().toString(36).slice(2)}`,
    fileName,
    source,
    createdAt,
    markdown,
  };
}

export async function synchronizeDocument(
  document: DocumentState,
  config: WebDavConfig,
): Promise<{ document: DocumentState; backups: BackupEntry[]; message: string }> {
  const remote = await getRemoteMetadata(config, document.fileName);
  const direction = decideSyncDirection({
    localModifiedAt: document.localModifiedAt,
    remoteModifiedAt: remote.modifiedAt,
  });

  if (direction === "download") {
    const remoteMarkdown = await downloadRemoteMarkdown(config, document.fileName);
    return {
      document: {
        ...document,
        markdown: remoteMarkdown,
        localModifiedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        lastSavedMarkdown: remoteMarkdown,
        saveStatus: "saved",
      },
      backups: [createBackup(document.fileName, "local", document.markdown)],
      message: "Remote file was newer. Local content was backed up and replaced.",
    };
  }

  if (direction === "upload") {
    const backups: BackupEntry[] = [];
    if (remote.modifiedAt) {
      const remoteMarkdown = await downloadRemoteMarkdown(config, document.fileName);
      backups.push(createBackup(document.fileName, "remote", remoteMarkdown));
    }
    await uploadRemoteMarkdown(config, document.fileName, document.markdown);
    return {
      document: {
        ...document,
        lastSyncedAt: new Date().toISOString(),
        lastSavedMarkdown: document.markdown,
        saveStatus: "saved",
      },
      backups,
      message: "Local file was newer. Remote content was backed up when present and replaced.",
    };
  }

  return {
    document: {
      ...document,
      lastSyncedAt: new Date().toISOString(),
      saveStatus: "saved",
    },
    backups: [],
    message: "Local and remote files are already in sync.",
  };
}

export async function pullRemoteDocument(
  document: DocumentState,
  config: WebDavConfig,
): Promise<{ document: DocumentState; backups: BackupEntry[]; message: string }> {
  const remote = await getRemoteMetadata(config, document.fileName);
  if (!remote.modifiedAt) {
    const remoteMarkdown = await downloadRemoteMarkdown(config, document.fileName).catch((error: unknown) => {
      if (error instanceof Error && error.message.includes("404")) {
        return undefined;
      }
      throw error;
    });

    if (remoteMarkdown === undefined) {
      return {
        document: {
          ...document,
          lastSyncedAt: new Date().toISOString(),
          syncError: undefined,
        },
        backups: [],
        message: "Remote file was not found. Local content was kept.",
      };
    }

    return {
      document: {
        ...document,
        markdown: remoteMarkdown,
        localModifiedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        lastSavedMarkdown: remoteMarkdown,
        saveStatus: "saved",
        syncError: undefined,
      },
      backups: [createBackup(document.fileName, "local", document.markdown)],
      message: "Remote file was pulled. Local content was backed up and replaced.",
    };
  }

  const local = new Date(document.localModifiedAt).getTime();
  const remoteTime = new Date(remote.modifiedAt).getTime();
  if (!Number.isNaN(remoteTime) && remoteTime <= local) {
    return {
      document: {
        ...document,
        lastSyncedAt: new Date().toISOString(),
        syncError: undefined,
      },
      backups: [],
      message: "Remote file is not newer. Local content was kept.",
    };
  }

  const remoteMarkdown = await downloadRemoteMarkdown(config, document.fileName);
  return {
    document: {
      ...document,
      markdown: remoteMarkdown,
      localModifiedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      lastSavedMarkdown: remoteMarkdown,
      saveStatus: "saved",
      syncError: undefined,
    },
    backups: [createBackup(document.fileName, "local", document.markdown)],
    message: "Remote file was newer. Local content was backed up and replaced.",
  };
}
