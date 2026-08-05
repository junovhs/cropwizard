// Copies the non-TypeScript assets into dist/. Node-only so it behaves the
// same on Windows (npm runs scripts through cmd.exe) as it does on a shell.
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/src', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('src/styles.css', 'dist/src/styles.css');
// Vendored typefaces (DEC-01: no third-party requests at runtime). The licence
// travels with them, so the whole directory is copied rather than the woff2s.
cpSync('src/fonts', 'dist/src/fonts', { recursive: true });
