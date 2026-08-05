// Copies the non-TypeScript assets into dist/. Node-only so it behaves the
// same on Windows (npm runs scripts through cmd.exe) as it does on a shell.
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/src', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('src/styles.css', 'dist/src/styles.css');
