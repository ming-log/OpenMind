import { describe, expect, it } from "vitest";
import {
  createOpenListSharePath,
  createPublicShareRemoteUrl,
  createRemoteShareTarget,
  createRemoteShareUrl,
  createSharePayloadText,
  createShareUrl,
  decodeRemoteShareTarget,
  decodeSharePayload,
  loadRemoteSharePayload,
  parseAppRoute,
  verifyPublicShareReadable,
} from "./App";
import { createDefaultDocument } from "./domain/markdown";

describe("app routing helpers", () => {
  it("creates self-contained hash URLs for read-only share snapshots", () => {
    const document = {
      ...createDefaultDocument("共享任务"),
      id: "task 1/2",
    };
    const shareUrl = createShareUrl("http://127.0.0.1:5173/OpenMind/?mode=edit#old", document, "sage-mint");
    const route = parseAppRoute(new URL(shareUrl).hash);

    expect(shareUrl).toContain("http://127.0.0.1:5173/OpenMind/#/share-data/");
    expect(route.kind).toBe("snapshotShare");
    if (route.kind !== "snapshotShare") {
      throw new Error("Expected snapshot share route");
    }
    expect(decodeSharePayload(route.payload)?.document.root.title).toBe("共享任务");
  });

  it("parses share routes and falls back to the editor route", () => {
    expect(parseAppRoute("#/share/task%201")).toEqual({ kind: "localShare", documentId: "task 1" });
    expect(parseAppRoute("#/settings")).toEqual({ kind: "editor" });
  });

  it("creates stable remote share URLs without embedding credentials", () => {
    const target = createRemoteShareTarget({
      serverUrl: "https://alice:secret@dav.example.com/private",
      username: "alice",
      password: "secret",
      remoteDir: "/openmind",
      publicShareBaseUrl: "https://dav.example.com/openmind",
      rememberCredentials: false,
    }, "openmind-share-task-1.json");
    const shareUrl = createRemoteShareUrl(
      "http://127.0.0.1:5173/OpenMind/#/old",
      target,
    );
    const route = parseAppRoute(new URL(shareUrl).hash);

    expect(shareUrl).toContain("http://127.0.0.1:5173/OpenMind/#/share-remote/");
    expect(route.kind).toBe("remoteShare");
    if (route.kind !== "remoteShare") {
      throw new Error("Expected remote share route");
    }
    const decoded = decodeRemoteShareTarget(route.payload);
    expect(decoded?.provider).toBe("direct");
    if (!decoded || decoded.provider === "openlist") {
      throw new Error("Expected direct remote share target");
    }
    expect(decoded.url).toBe("https://dav.example.com/openmind/openmind-share-task-1.json");
  });

  it("uses a configured guest share base URL for viewer reads", () => {
    expect(createPublicShareRemoteUrl({
      serverUrl: "https://dav.example.com/private",
      username: "alice",
      password: "secret",
      remoteDir: "/maps",
      publicShareBaseUrl: "https://public.example.com/openmind/",
      rememberCredentials: false,
    }, "openmind-share-task 1.json")).toBe("https://public.example.com/openmind/openmind-share-task%201.json");
  });

  it("surfaces authenticated guest URLs before handing them to viewers", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("", { status: 401, statusText: "Unauthorized" });
    const target = createRemoteShareTarget({
      serverUrl: "https://dav.example.com/private",
      username: "alice",
      password: "secret",
      remoteDir: "/maps",
      publicShareBaseUrl: "https://public.example.com/openmind",
      rememberCredentials: false,
    }, "share.json");

    try {
      await expect(verifyPublicShareReadable(target))
        .rejects.toThrow("仍需要登录");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("creates OpenList share targets that resolve the raw_url through /api/fs/get", () => {
    const target = createRemoteShareTarget({
      serverUrl: "https://openlist.minglog.cn/dav",
      username: "alice",
      password: "secret",
      remoteDir: "/openmind",
      publicShareBaseUrl: "https://openlist.minglog.cn/openmind",
      publicShareProvider: "openlist",
      rememberCredentials: false,
    }, "openmind-share-task-mpo457ne-6o.json");
    const shareUrl = createRemoteShareUrl("http://127.0.0.1:5173/OpenMind/#/old", target);
    const route = parseAppRoute(new URL(shareUrl).hash);

    expect(createOpenListSharePath("/openmind", "openmind-share-task-mpo457ne-6o.json"))
      .toBe("/openmind/openmind-share-task-mpo457ne-6o.json");
    expect(target).toEqual({
      version: 1,
      provider: "openlist",
      apiUrl: "https://openlist.minglog.cn/api/fs/get",
      path: "/openmind/openmind-share-task-mpo457ne-6o.json",
      password: "",
    });
    expect(route.kind).toBe("remoteShare");
    if (route.kind !== "remoteShare") {
      throw new Error("Expected remote share route");
    }
    expect(decodeRemoteShareTarget(route.payload)).toEqual(target);
  });

  it("loads OpenList share JSON from the response raw_url", async () => {
    const originalFetch = globalThis.fetch;
    const document = createDefaultDocument("Live OpenList");
    const payloadText = createSharePayloadText(document, "sage-mint");
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const target = createRemoteShareTarget({
      serverUrl: "https://openlist.minglog.cn/dav",
      username: "alice",
      password: "secret",
      remoteDir: "/openmind",
      publicShareBaseUrl: "https://openlist.minglog.cn",
      publicShareProvider: "openlist",
      rememberCredentials: false,
    }, "openmind-share-task-mpo457ne-6o.json");
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input: input.toString(), init });
      if (calls.length === 1) {
        return new Response(JSON.stringify({
          code: 200,
          message: "success",
          data: {
            raw_url: "https://openlist.minglog.cn/p/webdav/openmind/openmind-share-task-mpo457ne-6o.json?sign=abc",
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(payloadText, { status: 200 });
    };

    try {
      const payload = await loadRemoteSharePayload(target);

      expect(payload.document.root.title).toBe("Live OpenList");
      expect(calls[0].input).toBe("https://openlist.minglog.cn/api/fs/get");
      expect(calls[0].init?.method).toBe("POST");
      expect(calls[0].init?.body).toBe(JSON.stringify({
        path: "/openmind/openmind-share-task-mpo457ne-6o.json",
        password: "",
      }));
      expect(calls[1].input)
        .toBe("https://openlist.minglog.cn/p/webdav/openmind/openmind-share-task-mpo457ne-6o.json?sign=abc");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
