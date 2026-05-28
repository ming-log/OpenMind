# OpenMind

<p>
  <a href="./README.md">中文</a> |
  <a href="https://github.com/ming-log/OpenMind">GitHub</a>
</p>

OpenMind is a local-first Markdown mind-mapping app. It keeps Markdown as the readable and portable source format while providing a visual mind-map editor, Markdown editing, task management, themes, PNG export, WebDAV sync, and dynamic read-only sharing.

![OpenMind logo](./public/openmind-logo.png)

## Features

- Markdown and mind-map modes: switch between a visual map and the Markdown source.
- Local-first editing: create, edit, import, export, and recover work without configuring WebDAV.
- Multiple tasks: keep multiple Markdown mind-map documents in browser storage.
- Node operations: add child, sibling, and parent nodes; delete nodes; drag subtrees; box-select multiple nodes; resize nodes.
- Group frames and notes: add frames around selected nodes or subtrees, then edit the frame note directly on the map.
- Markdown notes: node notes support basic Markdown rendering such as paragraphs, lists, bold, emphasis, inline code, images, and code blocks.
- PNG and Markdown export: export the full mind map as an image or as a Markdown file.
- Themes: choose from multiple built-in map themes.
- WebDAV sync: sync remote Markdown files directly from the browser by last modified time.
- Dynamic sharing: publish read-only JSON-backed share links through WebDAV, including direct public URLs and OpenList `raw_url` mode.
- Safer overwrite flow: before sync overwrites local or remote content, the overwritten version is saved into local backup history.

## Tech Stack

- React 19
- TypeScript
- Vite
- Vitest
- Browser LocalStorage
- Browser-side WebDAV

## Getting Started

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://127.0.0.1:5173/OpenMind/
```

If the port is already in use, Vite may choose another one.

## Commands

```bash
# Development
npm run dev

# Tests
npm test

# Type check
npm run typecheck

# Production build
npm run build

# Local mock WebDAV server
npm run mock:webdav
```

## Markdown Mapping

OpenMind uses heading levels to describe the mind-map structure. Body content under a heading becomes that node's note.

```markdown
# Root

Root note.

## Child

Child note.

### Grandchild

Grandchild note.
```

- `H1` is the root node.
- `H2` to `H6` become child nodes by heading level.
- Body text under a heading becomes the node note.
- If the Markdown has no `H1`, OpenMind creates a root from the file name and shows a warning.
- If the Markdown has multiple `H1` headings, OpenMind wraps later `H1` sections under the first root and shows a warning.

## WebDAV Sync

OpenMind talks to WebDAV directly from the browser using:

- `PROPFIND`
- `GET`
- `PUT`

Your WebDAV server must allow CORS for the app origin and methods. If the provider blocks browser cross-origin access, OpenMind keeps local content intact and shows a sync or connection failure message.

### Mock WebDAV

```bash
npm run mock:webdav
```

Then configure OpenMind settings with:

- WebDAV server: `http://127.0.0.1:5180`
- Remote directory: `/openmind`
- Username/password: leave blank

By default, the mock marks the remote file as newer so you can test pull and local backup behavior. To test upload:

```powershell
$env:OPENMIND_MOCK_WEBDAV_MODE="local-newer"; npm run mock:webdav
```

## Sharing

OpenMind supports two read-only sharing modes:

- Snapshot sharing: encodes the current map data into the URL, suitable for small temporary shares.
- Remote sharing: publishes JSON to WebDAV and generates a read-only link, suitable for cross-device and continuously updated shares.

Remote share links do not contain your WebDAV password. Publishing uses your configured WebDAV credentials, while viewers read the JSON from a public guest URL or an OpenList `raw_url`.

## Data and Security

- Data is stored in browser LocalStorage by default.
- WebDAV passwords are not stored by default.
- If "remember credentials" is enabled, the password is stored in browser LocalStorage in an obfuscated form. This is not strong encryption and is intended only for trusted personal devices.
- Before sync overwrites content, OpenMind creates a local backup that can be downloaded from Settings.

## Project Structure

```text
OpenMind/
├─ src/
│  ├─ components/     # React components
│  ├─ domain/         # Markdown, layout, sync, themes, and domain logic
│  └─ App.tsx         # App entry and state orchestration
├─ scripts/           # Local helper scripts
├─ docs/              # Requirements, design, and acceptance docs
├─ public/            # Static assets
└─ README.md          # Chinese README
```

## Development

Before submitting changes, run:

```bash
npm test
npm run typecheck
npm run build
```

The project does not require a backend for core editing. Except for WebDAV sync and dynamic sharing, editing happens locally in the browser.

## License

[MIT](./LICENSE)
