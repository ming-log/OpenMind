# Structure

```text
OpenMind/
├─ src/
│  ├─ components/     # React UI components (one component per file, .tsx)
│  ├─ domain/         # Pure domain logic (parsing, layout, sync, themes, storage)
│  ├─ App.tsx         # App entry: state orchestration, routing, wiring components to domain
│  ├─ main.tsx        # React DOM bootstrap
│  ├─ styles.css      # All styling (plain CSS)
│  └─ vite-env.d.ts
├─ scripts/           # Local helper scripts (e.g. mock-webdav.mjs)
├─ docs/              # Requirements, design, acceptance, and verification docs
├─ public/            # Static assets (logo, favicon)
├─ dist/              # Build output (generated)
├─ index.html         # Vite HTML entry
├─ README.md          # Chinese README (primary)
└─ README.en.md       # English README
```

## Architecture

Two clear layers:

- `src/domain/` — framework-agnostic, pure TypeScript. No React imports. This is where the real logic lives and where most tests are. Functions take inputs and return new values (immutable).
- `src/components/` — React presentation. Components render state and emit callbacks; they delegate logic to the domain layer.
- `src/App.tsx` — the orchestrator. Holds top-level state with hooks, handles routing (editor vs. share routes), and connects component callbacks to domain functions. Keep heavy logic out of `App.tsx`; push it into `domain/`.

## Domain Modules

- `types.ts` — shared types: `MindNode`, `DocumentState`, `GroupFrame`, `PersistedState`, `WebDavConfig`, etc.
- `markdown.ts` — parse Markdown ↔ mind map tree; serialize back. Keep symmetric.
- `tree.ts` — node operations (add/delete/move/update title, note, size; subtree collection).
- `canvasLayout.ts` — compute node positions/layout for the canvas.
- `selection.ts` — selection and box-select logic.
- `documents.ts` — multi-document management (e.g. delete-by-id with active fallback).
- `storage.ts` — LocalStorage persistence (load/save `PersistedState`).
- `sync.ts` — WebDAV connect, list, pull, push, synchronize.
- `themes.ts` — theme presets and lookup.
- `noteMarkdown.ts` — render node notes' Markdown subset.
- `pngExport.ts` — export the mind map as PNG.
- `ids.ts` — ID generation helpers.

## Conventions

- Tests sit beside their source file as `<name>.test.ts`.
- Components are `.tsx`; pure domain modules are `.ts`.
- When adding a feature, prefer a new or existing `domain/` module for the logic and a thin component for the UI, wired together in `App.tsx`.
- Reusable SVG icons go in `components/Icons.tsx`.
