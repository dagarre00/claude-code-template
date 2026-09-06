import { mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Node 25.2.1's fs.cpSync silently NO-OPS on Windows (no copy, no throw) when the
// destination path contains non-ASCII characters (e.g. an accented letter). Tests
// that deliberately use non-ASCII temp-dir prefixes to exercise path quoting must
// NOT use cpSync for fixture setup, or they fail with a downstream ENOENT that
// looks unrelated to the real cause. Do not "simplify" this back to cpSync.
export function copyRecursiveSync(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = resolve(src, entry.name);
    const to = resolve(dest, entry.name);
    if (entry.isDirectory()) copyRecursiveSync(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
    else throw new Error(`Unsupported fixture entry (not a file or directory): ${from}`);
  }
}
