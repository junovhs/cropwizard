# CropWizard — TypeScript edition

A dependency-light browser image cropper written in strict TypeScript. The runtime remains framework-free and uses native canvas, DOM, Blob, and File APIs.

For who this is for, what it deliberately is not, and the bar a feature has to clear, see [docs/product-philosophy.md](docs/product-philosophy.md).

## Commands

```bash
npm install
npm run typecheck
npm test
npm run build
npm run serve
```

Open `http://localhost:4173` after starting the server.

## Architecture

- `src/domain/` — shared domain contracts; no browser orchestration.
- `src/application/` — immutable framing and queue decisions.
- `src/infrastructure/` — browser adapters such as DOM validation and image decoding.
- `src/*.ts` — focused presentation controllers and rendering modules.
- `tests/` — deterministic tests for naming, search, state atomicity, framing commands, and ZIP output.

The application store treats each state transition as one atomic commit. Items, frames, adjustments, targets, and item arrays are frozen after publication. Update helpers skip no-op publications.

## Design constraints

- Strict TypeScript; no `any`, `@ts-ignore`, or `@ts-nocheck` escapes.
- Native ES modules and browser APIs.
- Pure framing commands return new items rather than mutating queue entries.
- Canvas animation stays local to the viewfinder to avoid abstraction overhead inside frame loops.
- Export rendering, encoding, naming, and ZIP creation remain separate units.
