export type SaveStatus = "saved" | "dirty" | "syncing" | "syncFailed";

export interface MindNode {
  id: string;
  title: string;
  note: string;
  level: number;
  side?: "left" | "right";
  children: MindNode[];
}

export interface GroupFrame {
  id: string;
  nodeIds: string[];
  note: string;
}

export interface ParseResult {
  root: MindNode;
  warnings: string[];
}

export interface DocumentState {
  id?: string;
  fileName: string;
  markdown: string;
  root: MindNode;
  groupFrames?: GroupFrame[];
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
  documents?: DocumentState[];
  activeDocumentId?: string;
  backups: BackupEntry[];
  webDavConfig: WebDavConfig;
}
