# Tech

## Stack

- React 19 (function components + hooks, `react-jsx` runtime — no `import React` needed)
- TypeScript (strict mode, `ES2022` target, `ESNext` modules, `Bundler` resolution, `noEmit`)
- Vite 8 as dev server and bundler (`base: "/OpenMind/"` for GitHub Pages)
- Vitest 4 for unit tests (configured via `vite.config.ts`, `test.environment: "node"`)
- Browser LocalStorage for persistence
- Browser-side WebDAV (`PROPFIND` / `GET` / `PUT`) for sync and sharing

No backend, no UI framework, no state library. Styling is plain CSS in `src/styles.css`.

## Common Commands

```bash
npm install            # install dependencies

npm run dev            # start Vite dev server (usually http://127.0.0.1:5173/OpenMind/)
npm test               # run the full test suite once (vitest run)
npm run test:watch     # watch-mode tests
npm run typecheck      # tsc --noEmit, no build
npm run build          # tsc --noEmit && vite build (production)
npm run mock:webdav    # local WebDAV mock server on http://127.0.0.1:5180
```

Before committing, run `npm test`, `npm run typecheck`, and `npm run build`.

Note: `npm run dev`, `npm run test:watch`, and `npm run mock:webdav` are long-running — start them in your own terminal, not as one-shot commands.

## Testing Conventions

- Tests live next to source as `*.test.ts` (mostly under `src/domain` and `src/components`).
- Tests run in the `node` environment; avoid relying on a real DOM unless the test sets one up.
- Domain logic is pure and heavily unit-tested. Add tests when adding or changing domain behavior.

## Code Style

- TypeScript strict everywhere; prefer explicit `interface` / `type` definitions (see `src/domain/types.ts`).
- Prefer pure functions and immutable updates (spread objects/arrays rather than mutating in place).
- Use the ID helpers in `src/domain/ids.ts` (`createNodeId`, `createStableTestId`) instead of ad-hoc ID generation.
- Keep parsing/serialization round-trippable: `parseMarkdown` and `serializeMarkdown` must stay symmetric.
- Match the existing two-space indentation and double-quote style.
- User-facing strings are in Simplified Chinese; keep new copy consistent.
