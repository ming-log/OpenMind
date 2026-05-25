# OpenMind MVP Design

## Goal

Build OpenMind as a local-first browser mind-mapping app where Markdown is the durable data format. The MVP must let a user create, import, edit, export, sync, and image-export a tree-shaped mind map without needing any hosted backend.

## Approved Direction

OpenMind will be a Vite, React, and TypeScript single page application. The app will keep Markdown as the canonical persistent document, derive a runtime tree from it for visual editing, and serialize visual edits back to Markdown immediately. Browser APIs will handle file import/export, local recovery storage, backup history, and direct WebDAV sync.

## Architecture

The app is split into focused modules:

- Markdown domain: parse Markdown headings and notes into `MindNode` trees, serialize trees back to Markdown, and provide pure tree editing helpers.
- Storage domain: persist the current document, file metadata, backup history, and WebDAV settings in browser local storage.
- Sync domain: test and execute WebDAV `PROPFIND`, `GET`, and `PUT` flows, choose overwrite direction by modification time, and save overwritten versions as backups.
- UI domain: render the toolbar, status surface, Markdown editor, mind map canvas, node context menu, note bubble, and settings modal.
- Export domain: render the complete tree to a canvas and download it as PNG.

The mind map canvas uses a lightweight deterministic tree layout. Nodes are positioned by depth and leaf order, edges are rendered as SVG paths, and the whole scene is transformed for pan and zoom. This keeps behavior easy to test and avoids coupling core data behavior to a heavy diagramming library.

## Data Model

```ts
export type SaveStatus = "saved" | "dirty" | "syncing" | "syncFailed";

export interface MindNode {
  id: string;
  title: string;
  note: string;
  level: number;
  children: MindNode[];
}

export interface DocumentState {
  fileName: string;
  markdown: string;
  root: MindNode;
  localModifiedAt: string;
  lastSavedMarkdown: string;
  lastSyncedAt?: string;
  saveStatus: SaveStatus;
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
```

`id` values are generated at runtime and never serialized to Markdown.

## Markdown Rules

- `H1` maps to the root node.
- `H2` through `H6` map to descendants by heading level.
- Text between a heading and the next same-or-higher heading becomes that node's note.
- Empty note text is valid.
- If no `H1` exists, the parser creates a root from the file name or a default title and treats the original content as the root note.
- If multiple `H1` headings exist, the first becomes root and later `H1` sections and descendants are parsed under it with a parse warning visible in the UI.
- Non-heading Markdown is preserved only as node notes; rich node content, links between nodes, tags, colors, and icons are outside MVP scope.

## Primary UI

The first screen is the editor itself, not a landing page. A compact top toolbar exposes:

- New
- Import Markdown
- Export Markdown
- Export PNG
- Sync
- Mode switch between mind map and Markdown
- Settings

The lower status area shows the file name, save state, parse/sync errors, and last sync time.

## Mind Map Mode

The canvas supports:

- Pan by dragging the empty canvas.
- Zoom controls and wheel zoom.
- Focus root or selected node.
- Add child from each node.
- Double click node title to edit.
- Right click a node to open actions: add child, edit title, edit note, delete.
- Delete confirmation that removes the selected node and its descendants.
- Hover note bubble for nodes with notes.
- Click note bubble trigger for pointer/touch users.

Node titles are the only always-visible node content. Notes are rendered in a small Markdown-text bubble.

## Markdown Mode

Markdown mode uses a plain text editor. Edits update the canonical Markdown string and dirty status. When switching back to mind map mode, the app parses the Markdown, refreshes the tree, and shows warnings for missing or repeated `H1` structures.

## File, Local Storage, and Backups

The app supports:

- New document with a default root.
- Import `.md` through the File API.
- Export `.md` through a Blob download.
- Local storage of the latest editing state to survive refresh.
- Backup entries stored in local storage before either local or remote content is overwritten.
- Backup list in settings with download actions.

The app never deletes local content after a sync failure.

## WebDAV Sync

The settings modal collects server URL, username, password or app password, remote directory, and a remember-credentials toggle. If credentials are remembered, the UI warns that they are stored in browser local storage and are only obfuscated, not truly secure.

Sync uses:

- `PROPFIND` to test connection and read remote `getlastmodified`.
- `GET` to download remote Markdown when remote is newer.
- `PUT` to upload local Markdown when local is newer.

Before remote overwrites local, the current local Markdown is saved as a `local` backup. Before local overwrites remote, the previous remote Markdown is saved as a `remote` backup. CORS, authentication, permission, and network failures are surfaced in the status area and settings modal.

## PNG Export

PNG export renders the complete tree, not the viewport. The export module computes the full layout bounds, paints edges and nodes to a canvas, then downloads a PNG.

## Error Handling

- Markdown parse warnings are non-destructive and do not discard the editor text.
- Failed imports leave the current document untouched.
- Failed exports show an error and keep editing state intact.
- Failed sync never deletes local Markdown.
- WebDAV CORS failures explain that the service must allow browser cross-origin access.

## Testing Strategy

Unit tests cover:

- Markdown parsing for `H1-H6`, empty notes, multi-paragraph notes, missing `H1`, and multiple `H1`.
- Tree editing helpers for add, title edit, note edit, delete with descendants, and root deletion protection.
- Markdown serialization after visual edits.
- Sync decision logic and backup creation.

Manual browser verification covers:

- New, import, visual edit, Markdown edit, export Markdown, export PNG.
- Hover/click note bubble behavior.
- Settings, WebDAV test failure messaging, and backup download UI.

## Design Self-Review

- The design covers every requirement in `docs/openmind-mvp-requirements.md`.
- The original MVP scope is preserved and non-MVP items remain excluded.
- The WebDAV implementation is intentionally browser-only and documents the CORS limitation.
- The main risk is real-world WebDAV provider variation; the implementation should keep sync errors visible and non-destructive.
