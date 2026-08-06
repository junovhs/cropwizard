// Copies the non-TypeScript assets into dist/. Node-only so it behaves the
// same on Windows (npm runs scripts through cmd.exe) as it does on a shell.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { writeIcon } from './raster-icon.mjs';

/**
 * Which build this is, stamped into the page.
 *
 * Not vanity: a deploy takes a minute to reach a phone, and a page that looks
 * identical to the last one is indistinguishable from a change that did not
 * work. Three separate bug reports have turned out to be a browser holding the
 * previous build. Now the page says which one it is, and the question is
 * answerable in a glance instead of by disproving it.
 */
function buildId() {
  // Vercel hands the commit to the build; a local build asks git itself.
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

mkdirSync('dist/src', { recursive: true });

const page = readFileSync('index.html', 'utf8')
  .replaceAll('{{build}}', buildId());
writeFileSync('dist/index.html', page);

cpSync('src/styles.css', 'dist/src/styles.css');
cpSync('src/favicon.svg', 'dist/src/favicon.svg');

// The tab icon is the SVG above; these are for the places that will not take
// one — a 32px square for browsers with no SVG-favicon support, and the 180px
// square iOS puts on a home screen, which never uses the SVG.
writeIcon('dist/favicon.png', 32);
writeIcon('dist/src/apple-touch-icon.png', 180);
// Vendored typefaces (DEC-01: no third-party requests at runtime). The licence
// travels with them, so the whole directory is copied rather than the woff2s.
cpSync('src/fonts', 'dist/src/fonts', { recursive: true });
