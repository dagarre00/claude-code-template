// Which engine runs which model — the one rule the loader, the launcher and the
// config editor all ask.
//
// Every adapter declares `modelPrefixes`: the ids its tool can run all start with
// one of them. It may also declare `modelExcludes`, prefixes inside those it does not
// run — Codex takes `gpt-` but not the open-weight `gpt-oss`, which is Antigravity's.
// Prefixes rather than a list of ids, so the newest model of a family fits the day
// it ships, and the family rather than the whole vendor, so it does not fit the
// wrong tool. A model id is stored under an engine's name (`engines.<engine>.models`,
// `roles.<role>.models.<engine>`), and the id is only ever passed to that engine's
// tool — so an id that engine cannot run there, a Codex id under `antigravity` say,
// is a configuration that loads and then fails when a worker starts.
//
// Pure and free of node, on purpose: the editor's page imports this same file, so
// what it warns about is exactly what dispatch would refuse. It is served to the
// browser at /model-fit.mjs (config-ui.mjs), and config-ui/model.mjs reaches it as
// `../model-fit.mjs`, which resolves to this file both on disk and over HTTP.

const starts = (prefixes, lower) => (prefixes ?? []).some(prefix => lower.startsWith(prefix.toLowerCase()));

// `spec` is anything with `modelPrefixes` (and maybe `modelExcludes`) — an adapter, or
// the page's copy of one. `inherit` is the config's word for "pass no model", so it
// fits every engine; a blank or a non-string is not a model and fits none.
export function modelFits(spec, id) {
  if (id === 'inherit') return true;
  if (typeof id !== 'string' || !id) return false;
  const lower = id.toLowerCase();
  return starts(spec?.modelPrefixes, lower) && !starts(spec?.modelExcludes, lower);
}

// Every engine that would run `id`. More than one is possible, and legitimate: agy
// serves Claude models beside its own.
export const enginesFor = (specs, id) => Object.keys(specs).filter(name => modelFits(specs[name], id));

const article = word => (/^[aeiou]/i.test(word) ? 'an' : 'a');

// One sentence a person can act on: what is wrong, what the engine does run, and —
// when some other engine does run it — where the id belongs.
export function explainMisfit(specs, engine, id) {
  const prefixes = specs[engine]?.modelPrefixes ?? [];
  const excludes = specs[engine]?.modelExcludes ?? [];
  const owners = enginesFor(specs, id);
  return `${JSON.stringify(id)} is not ${article(engine)} ${engine} model — ${engine} runs models starting with `
    + `${prefixes.join(', ') || '(nothing declared)'}${excludes.length ? `, except ${excludes.join(', ')}` : ''}.`
    + (owners.length ? ` It belongs to ${owners.join(' or ')}.` : '');
}
