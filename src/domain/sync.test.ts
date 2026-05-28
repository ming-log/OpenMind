import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "./markdown";
import { decideSyncDirection, joinWebDavPath, listRemoteMarkdownFiles, makeBasicAuthHeader, parseWebDavMarkdownFileList, pullRemoteDocument, synchronizeDocument, uploadRemoteText } from "./sync";

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

  it("parses WebDAV directory listings into sorted Markdown files", () => {
    const files = parseWebDavMarkdownFileList(`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/openmind/</d:href>
    <d:propstat><d:prop><d:getlastmodified>Mon, 25 May 2026 09:00:00 GMT</d:getlastmodified></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/openmind/Archive.txt</d:href>
    <d:propstat><d:prop><d:getlastmodified>Mon, 25 May 2026 11:00:00 GMT</d:getlastmodified></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/openmind/Project%20B.md</d:href>
    <d:propstat><d:prop><d:getlastmodified>Mon, 25 May 2026 10:00:00 GMT</d:getlastmodified></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/openmind/%E5%8E%86%E5%8F%B2.markdown</d:href>
    <d:propstat><d:prop><d:getlastmodified>Mon, 25 May 2026 12:00:00 GMT</d:getlastmodified></d:prop></d:propstat>
  </d:response>
</d:multistatus>`);

    expect(files.map((file) => file.fileName)).toEqual(["历史.markdown", "Project B.md"]);
  });

  it("lists Markdown files from the configured remote directory", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedDepth = "";
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedDepth = new Headers(init?.headers).get("Depth") ?? "";
      return new Response(`
        <d:multistatus xmlns:d="DAV:">
          <d:response>
            <d:href>/maps/Plan.md</d:href>
            <d:propstat><d:prop><d:getlastmodified>Mon, 25 May 2026 09:00:00 GMT</d:getlastmodified></d:prop></d:propstat>
          </d:response>
        </d:multistatus>
      `, { status: 207 });
    };

    const files = await listRemoteMarkdownFiles({
      serverUrl: "https://dav.example.com",
      username: "",
      password: "",
      remoteDir: "/maps",
      rememberCredentials: false,
    });

    globalThis.fetch = originalFetch;
    expect(capturedUrl).toBe("https://dav.example.com/maps");
    expect(capturedDepth).toBe("1");
    expect(files).toEqual([{ fileName: "Plan.md", modifiedAt: "2026-05-25T09:00:00.000Z" }]);
  });

  it("uploads JSON share publications with the requested content type", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedBody: BodyInit | null | undefined;
    let capturedContentType = "";
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedBody = init?.body;
      capturedContentType = new Headers(init?.headers).get("Content-Type") ?? "";
      return new Response("", { status: 201 });
    };

    await uploadRemoteText({
      serverUrl: "https://dav.example.com",
      username: "",
      password: "",
      remoteDir: "/maps",
      rememberCredentials: false,
    }, "openmind-share-task.json", "{\"version\":1}", "application/json;charset=utf-8");

    globalThis.fetch = originalFetch;
    expect(capturedUrl).toBe("https://dav.example.com/maps/openmind-share-task.json");
    expect(capturedBody).toBe("{\"version\":1}");
    expect(capturedContentType).toBe("application/json;charset=utf-8");
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

  it("pulls remote content without uploading when no remote modified time is provided", async () => {
    const originalFetch = globalThis.fetch;
    const document = createDefaultDocument("StartupPull");
    document.markdown = "# Local\n";
    document.localModifiedAt = "2026-05-25T10:00:00.000Z";
    const calls: string[] = [];
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.method ?? "GET");
      if (init?.method === "PROPFIND") {
        return new Response("<d:multistatus />", { status: 207 });
      }
      return new Response("# Remote\n", { status: 200 });
    };

    const result = await pullRemoteDocument(document, {
      serverUrl: "https://dav.example.com",
      username: "",
      password: "",
      remoteDir: "/maps",
      rememberCredentials: false,
    });

    globalThis.fetch = originalFetch;
    expect(calls).toEqual(["PROPFIND", "GET"]);
    expect(result.document.markdown).toBe("# Remote\n");
    expect(result.backups[0].source).toBe("local");
  });

  it("keeps local content during a startup pull when the remote file is not newer", async () => {
    const originalFetch = globalThis.fetch;
    const document = createDefaultDocument("LocalStillLatest");
    document.markdown = "# Local\n";
    document.localModifiedAt = "2026-05-25T10:00:00.000Z";
    const calls: string[] = [];
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.method ?? "GET");
      return new Response("<d:getlastmodified>Mon, 25 May 2026 09:00:00 GMT</d:getlastmodified>", { status: 207 });
    };

    const result = await pullRemoteDocument(document, {
      serverUrl: "https://dav.example.com",
      username: "",
      password: "",
      remoteDir: "/maps",
      rememberCredentials: false,
    });

    globalThis.fetch = originalFetch;
    expect(calls).toEqual(["PROPFIND"]);
    expect(result.document.markdown).toBe("# Local\n");
    expect(result.backups).toHaveLength(0);
  });
});
