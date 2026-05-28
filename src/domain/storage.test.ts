import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "./markdown";
import { createBackup } from "./sync";
import { createEmptyWebDavConfig, loadPersistedState, savePersistedState } from "./storage";
import { DEFAULT_THEME_ID } from "./themes";

describe("storage helpers", () => {
  it("returns a default document when localStorage has no saved state", () => {
    const store = new Map<string, string>();
    const state = loadPersistedState({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    });

    expect(state.document.root.title).toBe("OpenMind");
    expect(state.backups).toEqual([]);
    expect(state.webDavConfig).toEqual(createEmptyWebDavConfig());
    expect(state.themeId).toBe(DEFAULT_THEME_ID);
  });

  it("saves and reloads document state, backups, and obfuscated remembered WebDAV credentials", () => {
    const store = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    };
    const document = createDefaultDocument("Saved");
    const backup = createBackup("Saved.md", "local", "# Old");

    savePersistedState(adapter, {
      document,
      backups: [backup],
      themeId: "violet-orchid",
      webDavConfig: {
        serverUrl: "https://dav.example.com",
        username: "alice",
        password: "secret",
        remoteDir: "/maps",
        rememberCredentials: true,
      },
    });

    expect(store.get("openmind:v1")).not.toContain("secret");

    const loaded = loadPersistedState(adapter);

    expect(loaded.document.root.title).toBe("Saved");
    expect(loaded.backups[0].markdown).toBe("# Old");
    expect(loaded.webDavConfig.password).toBe("secret");
    expect(loaded.themeId).toBe("violet-orchid");
  });

  it("drops the password when credentials are not remembered", () => {
    const store = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    };

    savePersistedState(adapter, {
      document: createDefaultDocument("UnsavedSecret"),
      backups: [],
      themeId: DEFAULT_THEME_ID,
      webDavConfig: {
        serverUrl: "https://dav.example.com",
        username: "alice",
        password: "secret",
        remoteDir: "/maps",
        rememberCredentials: false,
      },
    });

    const loaded = loadPersistedState(adapter);

    expect(store.get("openmind:v1")).not.toContain("secret");
    expect(loaded.webDavConfig.password).toBe("");
  });
});
