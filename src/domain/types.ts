export type SaveStatus = "saved" | "dirty" | "syncing" | "syncFailed";

export interface MindNode {
  id: string;
  title: string;
  note: string;
  level: number;
  children: MindNode[];
}

export interface ParseResult {
  root: MindNode;
  warnings: string[];
}

export interface DocumentState {
  fileName: string;
  markdown: string;
  root: MindNode;
  localModifiedAt: string;
  lastSavedMarkdown: string;
  lastSyncedAt?: string;
  saveStatus: SaveStatus;
  warnings: string[];
  syncError?: string;
}

export interface BackupEntry {
  id: string;
  fileName: string;
  source: "local" | "remote";
  createdAt: string;
  markdown: string;
}

export interface WebDavConfig {
  serverUrl: string;
  username: string;
  remoteDir: string;
  rememberCredentials: boolean;
  password?: string;
}

export interface PersistedState {
  document: DocumentState;
  backups: BackupEntry[];
  webDavConfig: WebDavConfig;
}
