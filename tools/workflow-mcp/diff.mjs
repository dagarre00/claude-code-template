// Computes the diff a reviewer is being asked to review, so the prompt can
// carry it as data.
//
// The alternative was widening the worker allowlist to admit `git diff <a>..<b>`,
// and it is the worse of the two. The allowlist grants fixed command lines by
// exact match; a range makes the line unbounded, so admitting it means admitting
// a pattern. More importantly it leaves the diff *optional* — a reviewer that
// forgets, or is denied, reviews post-change files whole and says so in a
// disclaimer nobody reads. Embedding makes the diff present by construction: the
// conductor names a range, and the worker cannot be dispatched without it.
import { git } from './worktree.mjs';

// A revision range, and nothing that could be read as a flag or a path. Refs may
// carry `@{upstream}`-style suffixes and `~`/`^` walks, so those are in; a
// leading `-` and anything with shell punctuation or whitespace are out. The
// value reaches git as one argv element (never a shell word), so this is defence
// in depth against a mistyped conductor call, not the only thing standing
// between a range and a command line.
const RANGE = /^[A-Za-z0-9_][A-Za-z0-9._/@{}~^-]{0,199}$/;

// Big enough for any diff a single cycle should produce, small enough that a
// runaway one cannot quietly become the whole prompt. A review that needs more
// than this is a review that should have been split.
export const DEFAULT_MAX_DIFF_BYTES = 200_000;

export function computeDiff(root, range, { maxBytes = DEFAULT_MAX_DIFF_BYTES } = {}) {
  if (typeof range !== 'string' || !RANGE.test(range)) {
    throw new Error(`Invalid diff range ${JSON.stringify(range)}; expected a revision range like `
      + '`<sha>..<sha>`, `main..HEAD` or a single revision');
  }
  // `--` terminates the revision list: without it, a range that also names a
  // file in the tree is ambiguous and git picks for you.
  const stat = git(root, ['diff', '--stat', range, '--']);
  const full = git(root, ['diff', range, '--']);

  const bytes = Buffer.byteLength(full, 'utf8');
  const truncated = bytes > maxBytes;
  // On a line boundary: half a hunk header reads as a malformed diff, and a
  // reviewer that cannot parse the patch falls back to guessing, which is the
  // failure this whole parameter exists to remove.
  const patch = truncated
    ? full.slice(0, full.lastIndexOf('\n', maxBytes) + 1 || maxBytes)
      + `\n[diff truncated at ${maxBytes} of ${bytes} bytes — the range is too large to review in one `
      + 'dispatch. Narrow it, or review it in parts.]\n'
    : full;

  return { range, stat: stat.trim(), patch, bytes, truncated, empty: full.trim() === '' };
}
