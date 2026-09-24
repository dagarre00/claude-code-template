// The flags each engine's adapter passes on every run, as rows a person can read.
//
// The list is built by running the adapters, not by copying them: a sample
// command line is built for a read-only role and for a write role, split into
// flags, and each flag is matched to the note its adapter keeps in `flagNotes`.
// So the description cannot drift from what is really launched — a flag with no
// note comes back in `unexplained`, a note for a flag that is gone in `stale`,
// and test/engine-flags.test.mjs fails on either.
//
// It takes no config on purpose. Placeholder values stand in for anything a
// project sets (the model, the allowed commands), so the answer is the same on
// every machine and works while a config is half-edited.
import { ENGINES, buildCommand } from './engines/index.mjs';

const ACCESS = ['read-only', 'write'];

function sampleArgs(name, access) {
  const engine = ENGINES[name];
  // Every optional setting present, so an adapter that reads one shows its flag. The model
  // is a real id the engine runs, because the launcher refuses any other; it is only ever
  // shown as the note's placeholder ("<model>"), never as itself.
  const block = {
    executable: 'program', models: { balanced: engine.knownModels[0] }, effort: { balanced: engine.efforts[0] },
    toolOutputTokenLimit: 1, modelAutoCompactTokenLimit: 1
  };
  return buildCommand(
    { workerCommands: ['CMD1', 'CMD2'], workerTimeoutSeconds: 1800, engines: { [name]: block } },
    { engine: name, profile: 'balanced', access, workspace: '<worktree>', reportFile: '<report file>',
      agent: { name: '<agent>', dir: '<agent dir>' } }).args;
}

// argv → [{ key, value }]. A flag takes the next token as its value unless that
// token is another flag; `--flag=value` splits at the `=`; `-c key=value` is keyed
// as `-c key` (the key is what says what it does); a lone `-` and a leading
// subcommand are flags of their own.
function split(args) {
  const found = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (!token.startsWith('-') || token === '-') { found.push({ key: token, value: '' }); continue; }
    if (token === '-c') {
      const setting = args[++i] ?? '';
      const at = setting.indexOf('=');
      found.push({ key: `-c ${at < 0 ? setting : setting.slice(0, at)}`, value: at < 0 ? '' : setting.slice(at + 1) });
      continue;
    }
    const equals = token.indexOf('=');
    if (equals > 0) { found.push({ key: token.slice(0, equals), value: token.slice(equals + 1) }); continue; }
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('-')) { found.push({ key: token, value: next }); i++; }
    else found.push({ key: token, value: '' });
  }
  return found;
}

export function describeFlags(name) {
  const notes = ENGINES[name].flagNotes;
  const split_ = Object.fromEntries(ACCESS.map(access => [access, split(sampleArgs(name, access))]));
  const keys = [...new Set([...split_.write, ...split_['read-only']].map(flag => flag.key))];
  const values = (access, key) => split_[access].filter(flag => flag.key === key).map(flag => flag.value);
  const joined = list => [...new Set(list)].join(', ');

  const rows = keys.map(key => {
    const note = notes[key];
    const readOnly = values('read-only', key), write = values('write', key);
    const differs = JSON.stringify(readOnly) !== JSON.stringify(write);
    return {
      key, label: key,
      kind: note?.kind ?? 'unexplained',
      why: note?.why ?? 'No explanation is recorded for this flag yet.',
      // A note's own `value` stands in for anything the project's settings decide.
      value: note?.value ?? (differs ? null : joined(write)),
      byAccess: differs && !note?.value ? { 'read-only': joined(readOnly), write: joined(write) } : null,
      when: note?.when ?? null
    };
  });
  return {
    engine: name, rows,
    unexplained: keys.filter(key => !notes[key]),
    stale: Object.keys(notes).filter(key => !keys.includes(key))
  };
}
