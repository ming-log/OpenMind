import type { ThemeId } from "./themes";

export type SaveStatus = "saved" | "dirty" | "syncing" | "syncFailed";
export type { ThemeId } from "./themes";

export interface MindNode {
  id: string;
  title: string;
  note: string;
  level: number;
  side?: "left" | "right";
  size?: {
    width: number;
    height: number;
  };
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
  publicShareBaseUrl?: string;
  publicShareProvider?: "direct" | "openlist";
  rememberCredentials: boolean;
  password?: string;
}

export interface SharePublication {
  documentId: string;
  fileName: string;
  remoteUrl: string;
  updatedAt?: string;
  error?: string;
}

export interface PersistedState {
  document: DocumentState;
  documents?: DocumentState[];
  activeDocumentId?: string;
  backups: BackupEntry[];
  webDavConfig: WebDavConfig;
  themeId: ThemeId;
  sharePublications?: SharePublication[];
}
