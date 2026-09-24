#!/usr/bin/env node
// A local page for editing `.agents/config.json` without knowing its shape.
//
//   node tools/workflow-mcp/config-ui.mjs [--root <project>] [--port <n>] [--no-open]
//
// The file decides which programs a worker may run and which executables the
// dispatcher launches, so a server that writes it is a target. Three things keep
// it from being one: it listens on loopback only; every request must carry the
// Host it was started with (a page on another origin can resolve its own name to
// 127.0.0.1, and its Host says so); and the API needs a random token that exists
// only in the URL this process prints. A save is validated by the same function
// the dispatcher loads the file with, so the page cannot write what dispatch
// would refuse.
import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILES, loadCanonical } from './canonical.mjs';
import { CONFIG_KEYS, validateConfig } from './config.mjs';
import { describeFlags } from './engine-flags.mjs';
import { ENGINES, engineNames } from './engines/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = { '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/model.mjs': ['model.mjs', 'text/javascript; charset=utf-8'],
  // The rule for which engine runs which model. It is one file for the loader, the
  // launcher and this page, so it lives beside them rather than under config-ui/;
  // the second entry is where it is read from.
  '/model-fit.mjs': ['../model-fit.mjs', 'text/javascript; charset=utf-8'] };
const MAX_BODY = 1_000_000;

const fingerprint = text => createHash('sha256').update(text).digest('hex').slice(0, 16);

// What is on disk now, read fresh on every call: the file is also edited by
// hand and by agents, and the page must never act on a remembered copy.
function readState(root) {
  const path = resolve(root, '.agents/config.json');
  if (!existsSync(path)) {
    return { path, text: null, etag: null, config: null, parseError: 'Missing .agents/config.json', validationError: null };
  }
  const text = readFileSync(path, 'utf8');
  const state = { path, text, etag: fingerprint(text), config: null, parseError: null, validationError: null };
  try { state.config = JSON.parse(text); }
  catch (error) { return { ...state, parseError: `.agents/config.json is not valid JSON: ${error.message}` }; }
  try { validateConfig(structuredClone(state.config)); }
  catch (error) { state.validationError = error.message; }
  return state;
}

// What the page has to offer, taken from the project rather than hard-coded, so
// a fourth engine or a new role file appears without touching the page.
function describe(root) {
  const meta = {
    profiles: [...PROFILES],
    keys: CONFIG_KEYS,
    // Fixed, read-only: shown so it is clear what is passed and why, never editable.
    flags: Object.fromEntries(engineNames.map(name => [name, describeFlags(name)])),
    engines: Object.fromEntries(engineNames.map(name => [name, {
      efforts: [...ENGINES[name].efforts], knownModels: [...ENGINES[name].knownModels],
      // Which ids the engine runs (model-fit.mjs): the page offers only these and flags any other.
      modelPrefixes: [...ENGINES[name].modelPrefixes], modelExcludes: [...(ENGINES[name].modelExcludes ?? [])],
      modelAliases: { ...ENGINES[name].modelAliases }, canList: Boolean(ENGINES[name].listModels)
    }])),
    roles: [], rolesError: null
  };
  try {
    meta.roles = loadCanonical(root).roles.map(({ name, description, profile, access }) =>
      ({ name, description, profile, access }));
  } catch (error) { meta.rolesError = error.message; }
  return meta;
}

// Writes what the human wrote, in the file's own line endings. `config` is the
// page's object, never the normalized copy validation produces, which folds the
// architecture command into workerCommands and its rule files into
// protectedPaths — derived at every load, and noise if stored.
function save(root, config, etag) {
  const state = readState(root);
  if (state.etag === null || state.etag !== etag) {
    const error = new Error('.agents/config.json changed on disk since the page loaded it. Reload to see the change; nothing was written.');
    error.status = 409;
    throw error;
  }
  try { validateConfig(structuredClone(config)); }
  catch (error) { error.status = 400; throw error; }
  const eol = state.text.includes('\r\n') ? '\r\n' : '\n';
  const text = JSON.stringify(config, null, 2).replace(/\n/g, eol) + eol;
  const temp = `${state.path}.${process.pid}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, state.path);
  return { ok: true, etag: fingerprint(text) };
}

// Asks each engine's own tool which models it has. The program is the one the saved
// config names, launched the way dispatch launches it (no shell), with arguments fixed
// by the adapter — never anything the page sent. One engine failing, or printing
// something the adapter cannot read, is reported for that engine and nothing else.
const runProgram = (executable, args) => new Promise((done, fail) => {
  execFile(executable, args, { timeout: 20_000, maxBuffer: 5_000_000, windowsHide: true, encoding: 'utf8' },
    (error, stdout) => {
      if (!error) return done(stdout);
      fail(error.killed ? new Error(`${executable} did not answer within 20 seconds`) : error);
    });
});

async function listModels(root, runList) {
  const saved = readState(root).config;
  const entries = await Promise.all(engineNames.map(async name => {
    const list = ENGINES[name].listModels;
    if (!list) return [name, { ok: false, reason: `${name} has no command that lists its models` }];
    const executable = saved?.engines?.[name]?.executable;
    if (typeof executable !== 'string' || !executable.trim() || /[\r\n\0]/.test(executable)) {
      return [name, { ok: false, reason: `no executable is set for ${name} in the saved config` }];
    }
    if (/\.(cmd|bat)$/i.test(executable)) {
      return [name, { ok: false, reason: `${executable} is a shell shim, which the workflow does not launch` }];
    }
    try { return [name, { ok: true, models: list.parse(await runList(executable, list.args)) }]; }
    catch (error) { return [name, { ok: false, reason: String(error.message).split('\n')[0].slice(0, 300) }]; }
  }));
  return { engines: Object.fromEntries(entries) };
}

function readBody(req) {
  return new Promise((done, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { fail(Object.assign(new Error('Request body too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { done(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { fail(Object.assign(new Error('Request body is not valid JSON'), { status: 400 })); }
    });
    req.on('error', fail);
  });
}

export async function startConfigServer(root, { port = 0, runList = runProgram } = {}) {
  root = resolve(root);
  const token = randomBytes(16).toString('hex');
  let boundPort = null;

  const send = (res, status, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, {
      'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"
    });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const tokenOk = supplied => {
    const a = Buffer.from(String(supplied ?? '')), b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  };

  const route = async (req, res) => {
    if (![`127.0.0.1:${boundPort}`, `localhost:${boundPort}`].includes(req.headers.host)) {
      return send(res, 403, { error: 'Unexpected Host header' });
    }
    const { pathname } = new URL(req.url, 'http://placeholder');

    if (req.method === 'GET' && PAGE[pathname]) {
      const [file, type] = PAGE[pathname];
      return send(res, 200, readFileSync(resolve(HERE, 'config-ui', file), 'utf8'), type);
    }
    if (!pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (!tokenOk(req.headers['x-config-token'])) return send(res, 403, { error: 'Missing or wrong token; use the URL the command printed' });

    if (req.method === 'GET' && pathname === '/api/config') {
      const { text, path, ...state } = readState(root);
      return send(res, 200, { ...state, path: '.agents/config.json', meta: describe(root) });
    }
    if (req.method === 'POST' && ['/api/validate', '/api/save', '/api/models'].includes(pathname)) {
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
        return send(res, 415, { error: 'Send application/json' });
      }
      const body = await readBody(req);
      if (pathname === '/api/models') return send(res, 200, await listModels(root, runList));
      if (pathname === '/api/save') return send(res, 200, save(root, body.config, body.etag));
      try { validateConfig(structuredClone(body.config)); } catch (error) { error.status = 400; throw error; }
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'Not found' });
  };

  const server = createServer((req, res) => {
    route(req, res).catch(error => send(res, error.status ?? 500, { error: error.message }));
  });
  await new Promise((done, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', done); });
  boundPort = server.address().port;

  return {
    server, token, port: boundPort,
    url: `http://127.0.0.1:${boundPort}/?t=${token}`,
    close: () => new Promise(done => { server.close(() => done()); server.closeAllConnections?.(); })
  };
}

function openBrowser(url) {
  const [command, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => { /* the URL is printed either way */ });
    child.unref();
  } catch { /* same */ }
}

async function main() {
  const argv = process.argv.slice(2);
  const option = name => { const at = argv.indexOf(name); return at === -1 ? null : argv[at + 1]; };
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: node tools/workflow-mcp/config-ui.mjs [--root <project>] [--port <n>] [--no-open]');
    return;
  }
  const root = resolve(option('--root') ?? resolve(HERE, '../..'));
  if (!existsSync(resolve(root, '.agents'))) {
    console.error(`No .agents/ directory under ${root}. Pass --root <your project>.`);
    process.exitCode = 1;
    return;
  }
  const editor = await startConfigServer(root, { port: Number(option('--port') ?? 0) });
  console.log(`Editing ${resolve(root, '.agents/config.json')}\n\n  ${editor.url}\n`);
  console.log('Changes apply to the next dispatch — no restart needed. Press Ctrl+C here when you are done.');
  if (!argv.includes('--no-open')) openBrowser(editor.url);
}

// Not `import.meta.url === argv[1]`: on Windows the two spell the drive letter
// differently, and a script that silently does nothing is the worst failure.
const invoked = process.argv[1] && realpathSync.native(process.argv[1]) === realpathSync.native(fileURLToPath(import.meta.url));
if (invoked) main().catch(error => { console.error(error.message); process.exitCode = 1; });
