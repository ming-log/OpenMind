import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "./markdown";
import { decideSyncDirection, joinWebDavPath, makeBasicAuthHeader, synchronizeDocument } from "./sync";

describe("sync helpers", () => {
  it("uploads when local content is newer than remote content", () => {
    expect(
      decideSyncDirection({
        localModifiedAt: "2026-05-25T09:00:00.000Z",
        remoteModifiedAt: "2026-05-25T08:59:00.000Z",
      }),
    ).toBe("upload");
  });

  it("downloads when remote content is newer than local content", () => {
    expect(
      decideSyncDirection({
        localModifiedAt: "2026-05-25T09:00:00.000Z",
        remoteModifiedAt: "2026-05-25T09:01:00.000Z",
      }),
    ).toBe("download");
  });

  it("normalizes WebDAV paths without dropping nested remote directories", () => {
    expect(joinWebDavPath("https://dav.example.com/base/", "/maps/team", "open mind.md")).toBe(
      "https://dav.example.com/base/maps/team/open%20mind.md",
    );
  });

  it("creates a Basic auth header from username and password", () => {
    expect(makeBasicAuthHeader("alice", "secret")).toBe("Basic YWxpY2U6c2VjcmV0");
  });

  it("backs up local content before downloading newer remote content", async () => {
    const originalFetch = globalThis.fetch;
    const document = createDefaultDocument("RemoteWins");
    document.markdown = "# Local\n";
    document.localModifiedAt = "2026-05-25T08:00:00.000Z";
    const calls: string[] = [];
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.method ?? "GET");
      if (init?.method === "PROPFIND") {
        return new Response("<d:getlastmodified>Mon, 25 May 2026 09:00:00 GMT</d:getlastmodified>", { status: 207 });
      }
      return new Response("# Remote\n", { status: 200 });
    };

    const result = await synchronizeDocument(document, {
      serverUrl: "https://dav.example.com",
      username: "",
      password: "",
      remoteDir: "/maps",
      rememberCredentials: false,
    });

    globalThis.fetch = originalFetch;
    expect(calls).toEqual(["PROPFIND", "GET"]);
    expect(result.document.markdown).toBe("# Remote\n");
    expect(result.backups).toHaveLength(1);
    expect(result.backups[0].source).toBe("local");
    expect(result.backups[0].markdown).toBe("# Local\n");
  });

  it("backs up remote content before uploading newer local content", async () => {
    const originalFetch = globalThis.fetch;
    const document = createDefaultDocument("LocalWins");
    document.markdown = "# Local\n";
    document.localModifiedAt = "2026-05-25T10:00:00.000Z";
    const calls: string[] = [];
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.method ?? "GET");
      if (init?.method === "PROPFIND") {
        return new Response("<d:getlastmodified>Mon, 25 May 2026 09:00:00 GMT</d:getlastmodified>", { status: 207 });
      }
      if (init?.method === "GET") {
        return new Response("# Remote old\n", { status: 200 });
      }
      return new Response("", { status: 201 });
    };

    const result = await synchronizeDocument(document, {
      serverUrl: "https://dav.example.com",
      username: "",
      password: "",
      remoteDir: "/maps",
      rememberCredentials: false,
    });

    globalThis.fetch = originalFetch;
    expect(calls).toEqual(["PROPFIND", "GET", "PUT"]);
    expect(result.backups).toHaveLength(1);
    expect(result.backups[0].source).toBe("remote");
    expect(result.backups[0].markdown).toBe("# Remote old\n");
  });
});
