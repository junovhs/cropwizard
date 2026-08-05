# TypeScript migration summary

## What changed

- Converted every runtime JavaScript module to strict TypeScript.
- Added authoritative domain contracts for queue items, framing, adjustments, targets, presets, search results, and export settings.
- Replaced direct nested queue mutations with immutable application commands and atomic store commits.
- Deep-froze published state, item records, frames, adjustments, target records, and item arrays.
- Added no-op suppression so unchanged item updates do not publish or re-freeze state.
- Extracted framing decisions into `src/application/framing.ts`.
- Extracted browser image decoding into `src/infrastructure/image-decoder.ts`.
- Extracted export, naming, quality, and scale UI into `src/presentation/export-panel.ts`.
- Added validated DOM and canvas access helpers.
- Added strict interfaces around the viewfinder, filmstrip, size picker, adjustment panel, and export panel.
- Preserved the native ES-module, framework-free runtime.
- Added deterministic tests for search, filename expansion, framing immutability, store atomicity, and ZIP output.

## Verification performed

- `tsc --noEmit`
- production build through `npm run build`
- all Node tests through `npm test`
- syntax validation of every emitted JavaScript module
- emitted module-graph validation for missing relative imports

## Deliberate performance choices

- The animation loop and canvas transform state remain local to the viewfinder.
- Thumbnail rendering still uses change keys to avoid unnecessary redraws.
- Export downscaling still uses progressive halving for large reductions.
- Store item updates skip publication when the updater returns the same item.
- No framework, dependency-injection container, or runtime state library was added.
