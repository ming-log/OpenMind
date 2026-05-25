# OpenMind MVP Verification Audit

Date: 2026-05-25

## Verified in Current Workspace

- Project starts as a Vite, React, TypeScript web application.
- Main editor screen contains toolbar, mind map mode, Markdown mode, settings, and status bar.
- Markdown parsing supports H1-H6 trees, multi-paragraph notes, missing H1 fallback, and multiple H1 warning.
- Visual node editing supports add child, edit title, edit note, delete with confirmation, pan, zoom, and selected-node focus.
- Mind map edits serialize back to Markdown.
- Markdown edits parse back into the mind map when switching modes.
- Note bubbles render basic Markdown text tokens: paragraphs, lists, strong, emphasis, and inline code.
- File flows are implemented with browser APIs: new document, Markdown import, Markdown download, and PNG download.
- Local storage persists the active document, WebDAV settings, and backup history.
- WebDAV credentials are not persisted by default; remembered credentials are stored obfuscated rather than as the raw password.
- WebDAV sync logic supports PROPFIND metadata, GET download, PUT upload, last-modified overwrite choice, local backup before download, and remote backup before upload.
- Browser verification with a local CORS-enabled mock WebDAV server covered both sync directions:
  - Remote newer: remote Markdown replaced local content and old local Markdown appeared in backup history.
  - Local newer: local Markdown was uploaded to the mock server and old remote Markdown appeared in backup history.
- `scripts/mock-webdav.mjs` provides a repeatable local CORS WebDAV mock for future sync acceptance checks.
- `docs/openmind-mvp-acceptance-checklist.md` provides a manual acceptance checklist mapped to the MVP requirements.
- CORS/network failures are surfaced as sync/test connection messages without deleting local content.
- A 500 child node Markdown document parses and lays out in an automated performance test.
- npm audit currently reports zero vulnerabilities.
- `README.md` documents local setup, verification commands, Markdown mapping, WebDAV CORS requirements, credential storage behavior, and local-first backup safety.

## Verification Commands

- `npm test`: 18 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm audit --audit-level=moderate`: found 0 vulnerabilities.
- Mock WebDAV server check: `PROPFIND http://127.0.0.1:5180/openmind/OpenMind.md` returned 207.
- Browser smoke on `http://127.0.0.1:5174`: load, add node, Markdown edit, return to map, settings, PNG button, and console error check passed.
- Browser WebDAV smoke on `http://127.0.0.1:5174` with mock server `http://127.0.0.1:5180`: remote-newer download path and local-newer upload path passed, with backup rows visible in Settings.

## Not Fully Proved Locally

- Real third-party WebDAV provider compatibility still depends on provider-specific CORS and authentication behavior.
- Cross-platform acceptance on macOS and Ubuntu still requires running the same browser paths on those operating systems; the implementation uses standard browser APIs and has been verified in the current Windows environment.
