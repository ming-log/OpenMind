import { createDefaultDocument } from "./markdown";
import type { PersistedState, WebDavConfig } from "./types";

const STORAGE_KEY = "openmind:v1";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createEmptyWebDavConfig(): WebDavConfig {
  return {
    serverUrl: "",
    username: "",
    remoteDir: "",
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
  const fallback: PersistedState = {
    document: createDefaultDocument("OpenMind"),
    backups: [],
    webDavConfig: createEmptyWebDavConfig(),
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
    return {
      document: parsed.document ?? fallback.document,
      backups: parsed.backups ?? [],
      webDavConfig: {
        ...webDavConfig,
        password: decodeSecret(webDavConfig.password),
      },
    };
  } catch {
    return fallback;
  }
}

export function savePersistedState(storage: StorageAdapter = window.localStorage, state: PersistedState): void {
  const config = state.webDavConfig.rememberCredentials
    ? { ...state.webDavConfig, password: encodeSecret(state.webDavConfig.password ?? "") }
    : { ...state.webDavConfig, password: "" };
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      webDavConfig: config,
    }),
  );
}
