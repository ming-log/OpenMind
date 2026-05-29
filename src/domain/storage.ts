import { createDefaultDocument, parseMarkdown, serializeMarkdown } from "./markdown";
import { DEFAULT_THEME_ID, getThemePreset } from "./themes";
import type { DocumentState, PersistedState, WebDavConfig } from "./types";

const STORAGE_KEY = "openmind:v1";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createEmptyWebDavConfig(): WebDavConfig {
  return {
    serverUrl: "",
    username: "",
    remoteDir: "/openmind",
    publicShareBaseUrl: "",
    publicShareProvider: "direct",
    rememberCredentials: false,
    password: "",
  };
}

function encodeSecret(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte ^ 73);
  });
  return `obf:${btoa(binary)}`;
}

function decodeSecret(value?: string): string {
  if (!value) {
    return "";
  }
  if (!value.startsWith("obf:")) {
    return value;
  }
  try {
    const binary = atob(value.slice(4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0) ^ 73);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export function loadPersistedState(storage: StorageAdapter = window.localStorage): PersistedState {
  const defaultDocument = createDefaultDocument("OpenMind");
  const fallback: PersistedState = {
    document: defaultDocument,
    documents: [defaultDocument],
    activeDocumentId: defaultDocument.id,
    backups: [],
    webDavConfig: createEmptyWebDavConfig(),
    themeId: DEFAULT_THEME_ID,
    sharePublications: [],
  };

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const webDavConfig = {
      ...createEmptyWebDavConfig(),
      ...(parsed.webDavConfig ?? {}),
    };
    const document = parsed.document ?? fallback.document;
    const documents = (parsed.documents?.length ? parsed.documents : [document]).map((entry, index) => (
      migrateDocumentFrames({
        ...entry,
        id: entry.id ?? `task-${index + 1}`,
        groupFrames: entry.groupFrames ?? [],
      })
    ));
    const activeDocumentId = parsed.activeDocumentId ?? document.id ?? documents[0]?.id;
    return {
      document: documents.find((entry) => entry.id === activeDocumentId) ?? documents[0] ?? document,
      documents,
      activeDocumentId,
      backups: parsed.backups ?? [],
      webDavConfig: {
        ...webDavConfig,
        password: decodeSecret(webDavConfig.password),
      },
      themeId: getThemePreset(parsed.themeId).id,
      sharePublications: parsed.sharePublications ?? [],
    };
  } catch {
    return fallback;
  }
}

function migrateDocumentFrames(document: DocumentState): DocumentState {
  const groupFrames = document.groupFrames ?? [];
  if (!groupFrames.length || document.markdown.includes("openmind:frames=")) {
    return { ...document, groupFrames };
  }

  const markdown = serializeMarkdown(document.root, groupFrames);
  const parsed = parseMarkdown(markdown, document.fileName);
  return {
    ...document,
    markdown,
    groupFrames: parsed.groupFrames,
    lastSavedMarkdown: document.lastSavedMarkdown === document.markdown ? markdown : document.lastSavedMarkdown,
  };
}

export function savePersistedState(storage: StorageAdapter = window.localStorage, state: PersistedState): void {
  const config = state.webDavConfig.rememberCredentials
    ? { ...state.webDavConfig, password: encodeSecret(state.webDavConfig.password ?? "") }
    : { ...state.webDavConfig, password: "" };
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      document: state.documents?.find((entry) => entry.id === state.activeDocumentId) ?? state.document,
      webDavConfig: config,
    }),
  );
}
