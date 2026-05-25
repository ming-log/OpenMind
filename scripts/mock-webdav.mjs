import http from "node:http";

const port = Number(process.env.OPENMIND_MOCK_WEBDAV_PORT ?? 5180);
const host = process.env.OPENMIND_MOCK_WEBDAV_HOST ?? "127.0.0.1";
const remoteMode = process.env.OPENMIND_MOCK_WEBDAV_MODE ?? "remote-newer";
const offsetMs = remoteMode === "local-newer" ? -60 * 60 * 1000 : 60 * 60 * 1000;

const state = {
  markdown:
    process.env.OPENMIND_MOCK_WEBDAV_MARKDOWN ??
    "# Remote Root\n\nRemote **note** from mock WebDAV.\n\n## Remote Child\n\n- synced\n- backed up\n",
  modifiedAt: new Date(Date.now() + offsetMs).toUTCString(),
  putCount: 0,
};

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "OPTIONS, PROPFIND, GET, PUT");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Depth, Content-Type");
  response.setHeader("Access-Control-Expose-Headers", "Last-Modified");
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  cors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "PROPFIND") {
    response.writeHead(207, { "Content-Type": "application/xml" });
    response.end(`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>${request.url}</d:href>
    <d:propstat>
      <d:prop>
        <d:getlastmodified>${state.modifiedAt}</d:getlastmodified>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`);
    return;
  }

  if (request.method === "GET") {
    response.writeHead(200, {
      "Content-Type": "text/markdown;charset=utf-8",
      "Last-Modified": state.modifiedAt,
    });
    response.end(state.markdown);
    return;
  }

  if (request.method === "PUT") {
    state.markdown = await collectBody(request);
    state.modifiedAt = new Date().toUTCString();
    state.putCount += 1;
    console.log(`[mock-webdav] PUT ${request.url} (${state.markdown.length} chars, total ${state.putCount})`);
    response.writeHead(201);
    response.end("");
    return;
  }

  response.writeHead(405);
  response.end("");
});

server.listen(port, host, () => {
  console.log(`[mock-webdav] listening at http://${host}:${port}`);
  console.log(`[mock-webdav] mode: ${remoteMode}`);
  console.log("[mock-webdav] use this server URL in OpenMind settings, with any remote directory");
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
