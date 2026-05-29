# Product

OpenMind is a local-first Markdown mind mapping tool that runs entirely in the browser. Markdown is the readable, portable source of truth; the app renders it as an interactive mind map and keeps the two views in sync.

## Core Capabilities

- Dual view: switch between a visual mind map and the Markdown source.
- Local-first: create, edit, import, export, and restore without any backend. Data lives in browser LocalStorage.
- Multi-task: keep several Markdown mind maps saved locally.
- Node editing: add child / sibling / parent nodes, delete, drag-move, box-select, and resize.
- Group frames and notes: wrap a node or subtree in a frame and edit a note above it.
- Markdown annotations: node notes support paragraphs, lists, bold, emphasis, inline code, images, and code blocks.
- Export: full mind map as PNG, or the document as Markdown.
- Themes: multiple built-in mind map themes.
- WebDAV sync: connect directly to WebDAV from the browser and sync remote Markdown by modified time.
- Sharing: read-only share links via URL snapshot or WebDAV-published JSON (supports direct public URLs and OpenList `raw_url`).
- Safe backups: before sync overwrites local or remote content, the overwritten version is saved to local backup history.

## Product Principles

- No backend dependency for core editing. WebDAV sync and sharing are the only network features.
- Markdown is the canonical format; never lose user content silently — surface warnings instead.
- Treat local data and credentials cautiously. Passwords are not saved by default; "remember credentials" only obfuscates, it is not strong encryption.

## Audience and UI Language

The primary UI, warnings, and user-facing strings are in Simplified Chinese (中文). Keep new user-facing text consistent with the existing Chinese copy. Documentation exists in both Chinese (`README.md`) and English (`README.en.md`).
