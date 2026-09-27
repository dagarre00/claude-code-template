#!/usr/bin/env node
// Builds a release of the template: a zip of one committed ref, minus what only
// the template itself uses, for a new project to start from.
//
//   node scripts/release.mjs <version> [--ref <ref>] [--out <dir>] [--repo <dir>]
//
// <version> names the zip and the one folder inside it. The ref defaults to the
// tag of that name, so a published release is always what was tagged; `--ref
// HEAD` previews one before tagging. The zip goes to the system temp directory
// unless --out says otherwise, and its path is the only thing printed.
// .github/workflows/release.yml runs this for every published GitHub release and
// attaches the zip to it.
//
// `git archive` reads the ref, never the working tree, so node_modules/,
// worktrees, local settings and uncommitted edits cannot leak in. Line endings
// are the repository's (LF), whatever the builder's core.autocrlf says.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));

export const NAME = 'claude-code-template';

class ReleaseError extends Error {}

// Paths only the template uses, file or directory, each with why a project never
// needs it.
export const TEMPLATE_ONLY = {
  'tools/workflow-mcp/test': "the template's own suite; an adopting project never runs it (adopt.sh and /project:sync-template drop it too)",
  '.github/workflows': "the template's CI runs that suite, and release.yml builds this zip; /project:init step 5c writes the project's own CI",
  'scripts': 'adopt.sh runs from a template checkout, and this script builds template releases'
};

// Files the release carries in another form: each takes the committed content
// and the version, and returns what ships.
export const REWRITTEN = {
  // Only "test" goes, with the suite it runs: "config" and "e2e" are documented
  // for adopters. Same edit as adopt.sh's.
  'tools/workflow-mcp/package.json': committed => {
    if (committed === null) throw new ReleaseError('tools/workflow-mcp/package.json is not in that commit');
    const pkg = JSON.parse(committed);
    if (pkg.scripts) {
      delete pkg.scripts.test;
      if (!Object.keys(pkg.scripts).length) delete pkg.scripts;
    }
    return JSON.stringify(pkg, null, 2) + '\n';
  },
  // The template's front page describes the template; the project gets a starter.
  'README.md': (_, version) => readFileSync(resolve(HERE, 'release-readme.md'), 'utf8')
    .replace(/\r\n/g, '\n').replaceAll('{{version}}', version)
};

// A tag-like name that is safe as a file and folder name.
const VERSION = /^[0-9A-Za-z][0-9A-Za-z._-]*$/;

const USAGE = 'Usage: node scripts/release.mjs <version> [--ref <ref>] [--out <dir>] [--repo <dir>]\n'
  + '  <version>  names the zip and its folder; built from the tag of that name unless --ref is given\n'
  + '  --ref      the commit to build from instead, e.g. HEAD to preview before tagging\n'
  + '  --out      where to write the zip (default: the system temp directory)\n'
  + '  --repo     the template checkout (default: the one this script is in)';

function gitIn(repo) {
  return (...args) => {
    const run = spawnSync('git', ['-C', repo, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (run.error) throw new ReleaseError(`git could not run: ${run.error.message}`);
    return run;
  };
}

// Returns the path of the zip it wrote. Throws a ReleaseError naming what to fix.
export function buildRelease({ version, ref, out = tmpdir(), repo = resolve(HERE, '..') }) {
  if (!VERSION.test(version ?? '')) {
    throw new ReleaseError(`"${version}" is not a release version: letters, digits, ".", "_" and "-", starting with a letter or digit`);
  }
  const git = gitIn(repo);
  const wanted = ref ?? `refs/tags/${version}`;
  const resolved = git('rev-parse', '--verify', '--quiet', `${wanted}^{commit}`);
  if (resolved.status !== 0) {
    throw new ReleaseError(ref ? `no commit "${ref}" in ${repo}`
      : `no tag "${version}" in ${repo}: tag the release first, or pass --ref HEAD to preview it`);
  }
  const commit = resolved.stdout.trim();
  const folder = `${NAME}-${version}`;

  const staging = mkdtempSync(resolve(tmpdir(), `${NAME}-release-`));
  try {
    // --add-file names an entry by the last --prefix before it plus the file's
    // basename, so each rewritten file is staged under its own basename.
    const added = Object.entries(REWRITTEN).flatMap(([path, rewrite], index) => {
      const shown = git('cat-file', 'blob', `${commit}:${path}`);
      const file = resolve(staging, String(index), basename(path));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, rewrite(shown.status === 0 ? shown.stdout : null, version));
      const at = dirname(path) === '.' ? '' : `${dirname(path)}/`;
      return [`--prefix=${folder}/${at}`, `--add-file=${file}`];
    });
    const dropped = [...Object.keys(TEMPLATE_ONLY), ...Object.keys(REWRITTEN)].map(path => `:(exclude)${path}`);

    mkdirSync(out, { recursive: true });
    const zip = resolve(out, `${folder}.zip`);
    // The last --prefix is the one the tracked files get.
    const archived = git('archive', '--format=zip', ...added, `--prefix=${folder}/`, '-o', zip, commit, '--', '.', ...dropped);
    if (archived.status !== 0) throw new ReleaseError(`git archive failed: ${archived.stderr.trim()}`);
    return zip;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function main() {
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({ allowPositionals: true,
      options: { ref: { type: 'string' }, out: { type: 'string' }, repo: { type: 'string' }, help: { type: 'boolean', short: 'h' } } }));
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 1;
  }
  if (values.help) { console.log(USAGE); return 0; }
  if (positionals.length !== 1) { console.error(USAGE); return 1; }
  try {
    console.log(buildRelease({ version: positionals[0], ref: values.ref, out: values.out && resolve(values.out),
      repo: values.repo && resolve(values.repo) }));
    return 0;
  } catch (error) {
    if (!(error instanceof ReleaseError)) throw error;
    console.error(`release: ${error.message}`);
    return 1;
  }
}

// Not `import.meta.url === argv[1]`: on Windows the two spell the drive letter
// differently, and a script that silently does nothing is the worst failure.
const invoked = process.argv[1] && realpathSync.native(process.argv[1]) === realpathSync.native(fileURLToPath(import.meta.url));
if (invoked) process.exitCode = main();
