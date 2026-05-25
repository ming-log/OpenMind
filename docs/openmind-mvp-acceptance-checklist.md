# OpenMind MVP Acceptance Checklist

Use this checklist after `npm run dev` and, for sync checks, `npm run mock:webdav`.

## Core Editing

- [ ] Open the app in a desktop browser.
- [ ] Click New and confirm the map contains one root node.
- [ ] Add a child from the root node.
- [ ] Add a nested child from the first child node.
- [ ] Double-click a node title and rename it.
- [ ] Right-click a node and edit its note.
- [ ] Right-click a non-root node, delete it, and confirm descendants are removed.
- [ ] Drag the canvas.
- [ ] Zoom in and out.
- [ ] Select a node and click the focus control.

## Markdown Mode

- [ ] Switch to Markdown mode.
- [ ] Confirm visual edits are reflected as headings and body notes.
- [ ] Replace the Markdown with an `H1`, `H2`, and `H3` hierarchy.
- [ ] Switch back to map mode and confirm the tree and notes are regenerated.
- [ ] Remove the `H1`, switch back, and confirm the app uses the file/default name as root and shows a warning.
- [ ] Add a second `H1` with nested `H2/H3` headings, switch back, and confirm those sections are parsed as nodes under the first root with a warning.

## Note Bubbles

- [ ] Add a note containing paragraphs, `**bold**`, `*emphasis*`, inline code, and list items.
- [ ] Hover the node and confirm the note bubble appears.
- [ ] Move away and confirm the hover bubble disappears.
- [ ] Click the node and confirm the note can be pinned for touch-style use.
- [ ] Confirm nodes without notes do not show empty bubbles.

## Files and Local Storage

- [ ] Import a `.md` file and confirm it becomes a tree.
- [ ] Export Markdown and confirm the downloaded file contains headings and notes.
- [ ] Export PNG and confirm a PNG download is created for the full map.
- [ ] Refresh the browser and confirm the latest document is restored.
- [ ] Confirm the status bar shows saved, dirty, syncing, or failed states as actions happen.

## WebDAV Sync With Mock Server

- [ ] Start `npm run mock:webdav`.
- [ ] Configure server URL `http://127.0.0.1:5180` and any remote directory.
- [ ] Click Test Connection and confirm success.
- [ ] Sync with the default mock mode and confirm remote Markdown replaces local content.
- [ ] Open Settings and confirm the old local Markdown appears as a local backup.
- [ ] Restart the mock with `OPENMIND_MOCK_WEBDAV_MODE=local-newer`.
- [ ] Edit local Markdown, sync, and confirm the mock logs a `PUT`.
- [ ] Open Settings and confirm old remote Markdown appears as a remote backup.

## Failure Safety

- [ ] Configure an invalid WebDAV server URL and sync.
- [ ] Confirm the app shows a failure message.
- [ ] Confirm local content remains intact after the failed sync.
- [ ] Confirm core edit/import/export flows still work without WebDAV configured.
