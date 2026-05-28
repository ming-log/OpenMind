# OpenMind

OpenMind is a local-first browser mind-mapping app that uses Markdown as the portable source format. It supports visual tree editing, Markdown editing, local recovery storage, PNG export, and browser-side WebDAV sync.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://127.0.0.1:5173`.

## Build and Verify

```bash
npm test
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

## Mock WebDAV Verification

You can run a local CORS-enabled mock WebDAV server for sync testing:

```bash
npm run mock:webdav
```

Then use this WebDAV server in OpenMind settings:

- Server URL: `http://127.0.0.1:5180`
- Remote directory: `/openmind`
- Username and password can be left blank.

By default the mock reports the remote file as newer, so syncing should download the remote Markdown and create a local backup. To test the upload path, start the mock as:

```bash
$env:OPENMIND_MOCK_WEBDAV_MODE="local-newer"; npm run mock:webdav
```

In that mode, edit the local document first, sync, and the mock should log a `PUT`.

## Core Features

- New mind map with a default root node.
- Import and export `.md` files.
- Switch between mind map mode and Markdown mode.
- Add child nodes from any node.
- Use keyboard shortcuts in map mode: Enter adds a sibling below the selected node, Tab adds a child, Delete deletes the selection, and Backquote edits the selected node note.
- Double-click a node title to edit it.
- Right-click a node for add, edit title, edit note, and delete.
- Delete confirmation removes the selected node and all descendants.
- Ctrl-drag box-selects multiple nodes for batch deletion; holding Space temporarily pans the canvas from anywhere without changing zoom.
- Use the mouse wheel without modifier keys to move the mind map vertically without changing zoom; use Ctrl+wheel to zoom at the pointer.
- Pan, zoom, focus the selected node, and resize nodes from their border handles.
- Hover or click nodes with notes to show note bubbles.
- Generate a dynamic read-only share link backed by WebDAV. Uploads use your WebDAV credentials, while viewers read a public/guest URL for the same JSON file; OpenList shares can POST `/api/fs/get` and read the returned `raw_url`.
- Note bubbles render basic Markdown: paragraphs, lists, bold, emphasis, and inline code.
- Export the complete mind map as PNG.
- Persist the latest document in browser local storage.
- Configure one WebDAV account and manually sync by last modified time.
- Save overwritten local or remote versions into browser backup history.

## Markdown Mapping

```markdown
# Root

Root note.

## Child

Child note.

### Grandchild

Grandchild note.
```

- `H1` is the root node.
- `H2-H6` become child nodes by heading level.
- Body text under a heading becomes that node's note.
- Missing `H1` creates a root from the file name and shows a warning.
- Multiple `H1` headings show a warning; additional `H1` sections and their descendants are parsed under the first root.

## WebDAV Notes

OpenMind talks to WebDAV directly from the browser with `PROPFIND`, `GET`, and `PUT`. The WebDAV server must allow CORS for the app origin and methods. If the provider blocks browser cross-origin access, the app will keep local content intact and show a sync or connection failure message.

Passwords are not stored by default. If "remember credentials" is enabled, the password is saved in browser local storage in an obfuscated form, which avoids raw plaintext but is still only appropriate for trusted personal devices.

## Local-First Safety

OpenMind does not need WebDAV to edit, import, export, or recover recent work. Before sync overwrites local or remote content, the overwritten Markdown is saved to local backup history and can be downloaded from Settings.
