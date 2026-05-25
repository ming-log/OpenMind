# OpenMind MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the OpenMind MVP browser app from `docs/openmind-mvp-requirements.md`.

**Architecture:** Vite, React, and TypeScript SPA with Markdown as the canonical document format. Pure domain modules handle Markdown, tree editing, local storage, sync decisions, and PNG export; React components handle the toolbar, editor modes, canvas, settings, and status.

**Tech Stack:** Vite, React, TypeScript, Vitest, browser File API, localStorage, fetch WebDAV, Canvas PNG export.

---

## File Structure

- Create `package.json`: project scripts and dependencies.
- Create `index.html`, `tsconfig.json`, `vite.config.ts`: Vite app setup.
- Create `src/main.tsx`: React bootstrap.
- Create `src/App.tsx`: top-level app state and workflows.
- Create `src/styles.css`: complete app styling.
- Create `src/domain/types.ts`: shared app types.
- Create `src/domain/ids.ts`: runtime ID generation.
- Create `src/domain/markdown.ts`: parse and serialize Markdown.
- Create `src/domain/tree.ts`: immutable tree edit helpers.
- Create `src/domain/storage.ts`: local storage persistence and backups.
- Create `src/domain/sync.ts`: WebDAV helpers and sync decision logic.
- Create `src/domain/pngExport.ts`: complete tree PNG export.
- Create `src/components/Toolbar.tsx`: top command bar.
- Create `src/components/StatusBar.tsx`: save/sync status.
- Create `src/components/MarkdownEditor.tsx`: plain text Markdown editor.
- Create `src/components/MindMapCanvas.tsx`: pan/zoom tree canvas and node interactions.
- Create `src/components/SettingsModal.tsx`: WebDAV settings and backup list.
- Create `src/domain/*.test.ts`: unit coverage for parser, tree, and sync.

## Tasks

### Task 1: Project scaffold

- [ ] Create Vite/React/TypeScript project files.
- [ ] Install dependencies with `npm install`.
- [ ] Verify `npm exec tsc --noEmit` starts from a valid project.

### Task 2: Domain model and Markdown

- [ ] Write tests for parsing and serialization edge cases.
- [ ] Implement shared types, ID generation, Markdown parser, and serializer.
- [ ] Run parser tests and typecheck.

### Task 3: Tree editing, storage, and sync logic

- [ ] Write tests for tree edit helpers and sync decisions.
- [ ] Implement add/edit/delete/focus-safe tree helpers.
- [ ] Implement local storage persistence and backup helpers.
- [ ] Implement WebDAV URL/auth utilities and newer-side decision logic.
- [ ] Run domain tests and typecheck.

### Task 4: UI shell and editor modes

- [ ] Implement `App`, toolbar, status bar, Markdown editor, and settings modal.
- [ ] Wire local storage hydration, new/import/export Markdown, mode switching, and dirty state.
- [ ] Run typecheck.

### Task 5: Mind map canvas and PNG export

- [ ] Implement deterministic tree layout with SVG edges and HTML nodes.
- [ ] Add pan, zoom, focus, add child, edit title, edit note, delete confirmation, context menu, and note bubbles.
- [ ] Implement complete-tree Canvas PNG export.
- [ ] Run typecheck.

### Task 6: WebDAV UI integration and verification

- [ ] Wire settings test connection and manual sync.
- [ ] Verify failed WebDAV/CORS paths are non-destructive and visible.
- [ ] Run full tests, build, and browser smoke test.

## Self-Review

- Requirement coverage: plan tasks cover edit, Markdown mode, note bubbles, file import/export, local storage, status, PNG, WebDAV config/test/sync/backups, and verification.
- Placeholder scan: no task depends on an undefined future placeholder.
- Type consistency: all tasks use the data types defined in the design spec.
