# Vendored fonts

DEC-01 forbids third-party requests at runtime, so the three typefaces the
style guide calls for are vendored here rather than loaded from a CDN. Each is
the **latin subset only** (`U+0000-00FF` plus common punctuation), which is what
the interface actually renders, and each is a variable font — one file covers
the whole weight range the CSS asks for.

| File | Family | Role | Axes |
|---|---|---|---|
| `fraunces-latin.woff2` | Fraunces | brand wordmark, display headlines | `opsz 9..144`, `wght 400..700` |
| `inter-tight-latin.woff2` | Inter Tight | interface copy, controls, labels | `wght 400..700` |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | filenames, dimensions, counts, tokens | `wght 400..600` |

All three are licensed under the SIL Open Font License 1.1 — see `OFL.txt`.
Copyright holders:

- Fraunces — The Fraunces Project Authors (https://github.com/undercasetype/Fraunces)
- Inter Tight — The Inter Project Authors (https://github.com/rsms/inter)
- JetBrains Mono — The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)

`@font-face` declarations live at the top of `../styles.css`. Every family
declares a real fallback stack, so the interface stays legible if a file is ever
missing.

To refresh a file, download the latin `woff2` that Google Fonts serves for the
family and replace it in place; no other step is needed, since `scripts/build-static.mjs`
copies this whole directory into `dist/`.
