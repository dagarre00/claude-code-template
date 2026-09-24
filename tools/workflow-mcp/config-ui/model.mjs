// The config editor's logic, kept free of the DOM and of node so the same file
// runs in the browser and under `node --test`. The page is only ever a view over
// these functions: what a role's form means, and what will actually run.
//
// One rule holds throughout: a form must write back exactly what it shows. A
// role the human never touched is written back as the very object that was
// read, so opening the editor and saving is not a diff.

// `../model-fit.mjs` is deliberately not `./`: the server serves that file at the root
// beside this one (/model-fit.mjs), and from /model.mjs a `..` stays at the root, so
// the same specifier reaches it in the browser and, from config-ui/, on disk.
import { enginesFor, modelFits } from '../model-fit.mjs';

// Rank 0 means "not in this role's chain". `inherit` is a chain entry like any
// engine — it means "whichever CLI is conducting" — but it has no model or
// effort of its own, so it appears in `rank` and nowhere else.
const rowNames = engineNames => ['inherit', ...engineNames];

export function roleToForm(role, engineNames) {
  const chain = role?.engine == null ? [] : [].concat(role.engine);
  const form = { follow: role?.engine == null, rank: {}, models: {}, effort: {} };
  for (const name of rowNames(engineNames)) form.rank[name] = chain.indexOf(name) + 1;
  for (const name of engineNames) {
    form.models[name] = role?.models?.[name] ?? '';
    form.effort[name] = role?.effort?.[name] ?? '';
  }
  return form;
}

// The shortest config that means the same thing: no chain is `null`, one engine
// is a string, several are a list in rank order. A blank field is no pin at all.
export function formToRole(form, engineNames) {
  const chain = form.follow ? null
    : rowNames(engineNames).filter(name => form.rank[name] > 0)
      .sort((a, b) => form.rank[a] - form.rank[b]);
  // A pin the page filled in for a new row and the human never changed is a default
  // the page chose for them, so it is written only while its engine is in the chain.
  const pins = kind => Object.fromEntries(engineNames
    .map(name => [name, typeof form[kind][name] === 'string' ? form[kind][name].trim() : form[kind][name]])
    .filter(([name, value]) => value != null && value !== '' && !(untouched(form, kind, name) && !chain?.includes(name))));
  return {
    engine: chain === null ? null : chain.length === 1 ? chain[0] : chain,
    models: pins('models'),
    effort: pins('effort')
  };
}

// What addToChain filled in, per form, as kind.engine → value. It lives beside the
// form rather than in it because the form is compared and written as it stands.
const filled = new WeakMap();
const fill = (form, kind, name, value) => {
  if (!value || form[kind][name]) return;
  form[kind][name] = value;
  if (!filled.has(form)) filled.set(form, new Map());
  filled.get(form).set(`${kind}.${name}`, value);
};
const untouched = (form, kind, name) => filled.get(form)?.get(`${kind}.${name}`) === form[kind][name];

// What a dispatch of this role would resolve to, in the order it would be tried:
// the role's own pin for the engine, else the engine's default for the role's
// profile. Mirrors dispatch.mjs; `inherit` stays unresolved because only the
// conducting CLI knows what it is.
export function effectiveChain(config, role, profile) {
  const configured = role?.engine ?? config.defaultEngine;
  return [...new Set([].concat(configured))].map(engine => {
    if (engine === 'inherit') return { engine };
    const block = config.engines?.[engine] ?? {};
    const model = role?.models?.[engine];
    const effort = role?.effort?.[engine];
    return {
      engine,
      model: model ?? block.models?.[profile] ?? null, modelFrom: model != null ? 'role' : 'profile',
      effort: effort ?? block.effort?.[profile] ?? null, effortFrom: effort != null ? 'role' : 'profile'
    };
  });
}

const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : v);
const same = (a, b) => canonical(a) === canonical(b);

// Whether a form still means what the role in the file already says: identical, or
// different only in ways that write the same role (a row added and taken out again).
const sameRole = (form, raw, engineNames) => same(form, roleToForm(raw, engineNames))
  || same(formToRole(form, engineNames), formToRole(roleToForm(raw, engineNames), engineNames));

// Rebuilds `roles` from the page's forms. A role in the file that the page has no
// form for (its role file was deleted) is kept untouched unless dropped; a role
// nobody customized is not added, so the file does not fill with empty stanzas.
export function assembleConfig(config, forms, engineNames, { drop = [] } = {}) {
  const roles = {};
  for (const [name, raw] of Object.entries(config.roles ?? {})) {
    if (drop.includes(name)) continue;
    const form = forms[name];
    // Keys the page does not edit (extraSkills) ride along untouched: rebuilding
    // a role from its form alone would drop them on every save.
    const { engine, models, effort, ...unmanaged } = raw ?? {};
    roles[name] = structuredClone(!form || sameRole(form, raw, engineNames) ? raw
      : { ...formToRole(form, engineNames), ...unmanaged });
  }
  for (const [name, form] of Object.entries(forms)) {
    if (name in roles || drop.includes(name) || sameRole(form, {}, engineNames)) continue;
    roles[name] = formToRole(form, engineNames);
  }
  return { ...structuredClone({ ...config, roles: undefined }), roles };
}

// The ids a model dropdown offers for one engine: the ids the adapter suggests, then
// every id the config already uses for that engine (the profile defaults and the
// role pins), so an id typed once can be picked everywhere, then `current`, so a value
// the lists do not know is still shown rather than silently replaced by another.
// Never another engine's ids, and never a blank.
//
// "Another engine's" is decided by `specs` (engine → { modelPrefixes }, the same rule
// dispatch applies): an id the engine cannot run is not offered, wherever it came
// from — a tool's list, a default, a pin. Only `current` is exempt, because hiding
// the value a dropdown is on would swap it without telling anyone; the page marks it.
export function modelChoices(engine, config, suggested = [], current = '', specs = null) {
  const used = [...Object.values(config.engines?.[engine]?.models ?? {}),
    ...Object.values(config.roles ?? {}).map(role => role?.models?.[engine])];
  const clean = id => typeof id === 'string' && id.trim() !== '';
  const offered = [...suggested, ...used].filter(id => clean(id) && (!specs || modelFits(specs[engine], id.trim())));
  return [...new Set([...offered, current].filter(clean).map(id => id.trim()))];
}

// Models the config keeps under an engine that cannot run them — the shape the
// loader now refuses, spelled the way the file spells it and with the path to each
// place, so the page can offer to clear it. A blank, `inherit` and a well-fitting id
// are never reported. `owners` is who does run it, which is usually the whole story
// ("that is a Codex model").
export function foreignModels(config, specs) {
  const found = new Map();
  const note = (engine, id, path) => {
    if (typeof id !== 'string' || !id.trim() || !specs[engine] || modelFits(specs[engine], id.trim())) return;
    const key = `${engine} ${id}`;
    if (!found.has(key)) found.set(key, { engine, id, owners: enginesFor(specs, id.trim()), where: [], paths: [] });
    found.get(key).where.push(path.join('.'));
    found.get(key).paths.push(path);
  };
  for (const [engine, block] of Object.entries(config?.engines ?? {})) {
    for (const [profile, id] of Object.entries(block?.models ?? {})) note(engine, id, ['engines', engine, 'models', profile]);
  }
  for (const [role, value] of Object.entries(config?.roles ?? {})) {
    for (const [engine, id] of Object.entries(value?.models ?? {})) note(engine, id, ['roles', role, 'models', engine]);
  }
  return [...found.values()];
}

// A list box holds one entry per line.
export const linesToList = text => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
export const listToLines = list => (list ?? []).join('\n');

// Keys in the file that the loader does not accept, with where each sits. The
// loader turned these from silently ignored into errors, so a project that syncs
// can be told "unknown key" about a setting this page has no field for — and the
// page has to be able to remove it, or it cannot fix the error it is showing.
export function findUnknownKeys(config, keys) {
  const found = [];
  const scan = (object, allowed, path) => {
    if (!object || typeof object !== 'object' || Array.isArray(object)) return;
    for (const key of Object.keys(object)) {
      if (!allowed.includes(key)) {
        found.push({ path: [...path, key], key, where: path.length ? path.join('.') : 'the top level' });
      }
    }
  };
  scan(config, keys.top, []);
  scan(config?.architecture, keys.architecture, ['architecture']);
  for (const [name, block] of Object.entries(config?.engines ?? {})) scan(block, keys.engine, ['engines', name]);
  for (const [name, role] of Object.entries(config?.roles ?? {})) scan(role, keys.role, ['roles', name]);
  return found;
}

// Fills in what the page renders but the file lacks — an engine block, a profile
// under `models` or `effort`, `roles` — so a half-written config opens instead of
// throwing while the page is being built. Empty fields are blank, not invented
// values: the loader still refuses the config until a human supplies them.
export function completeShape(config, engineNames, profiles) {
  const next = structuredClone(config);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(next.roles)) next.roles = {};
  if (!object(next.engines)) next.engines = {};
  for (const name of engineNames) {
    const block = object(next.engines[name]) ? next.engines[name] : { executable: '' };
    if (typeof block.executable !== 'string') block.executable = '';
    for (const field of ['models', 'effort']) {
      if (!object(block[field])) block[field] = {};
      for (const profile of profiles) if (!(profile in block[field])) block[field][profile] = null;
    }
    next.engines[name] = block;
  }
  return next;
}

// ─── the order a role's engines are tried in ───────────────────────────────
// The page lists the chain top to bottom and lets an engine be dragged. Ranks are
// the storage (`form.rank`, 1..n, 0 = not in the chain); these keep them
// contiguous, so "moved to here" always means one thing.

// The engines a role tries, in the order it tries them, then the ones it does not
// use. Ties (which only a hand-edited form can have) fall back to row order.
export function chainRows(form, engineNames) {
  const names = rowNames(engineNames);
  const used = names.filter(name => form.rank[name] > 0).sort((a, b) => form.rank[a] - form.rank[b]);
  return { used, unused: names.filter(name => !used.includes(name)) };
}

const renumber = (form, used, engineNames) => {
  for (const name of rowNames(engineNames)) form.rank[name] = used.indexOf(name) + 1;
};

// Puts `name` at `index` in the chain — 0 is tried first. The index counts
// positions among the *other* engines, so a row dropped "before this one" lands
// there whether it came from above or below. An unused engine joins the chain.
export function placeInChain(form, name, index, engineNames) {
  const others = chainRows(form, engineNames).used.filter(entry => entry !== name);
  others.splice(Math.max(0, Math.min(index, others.length)), 0, name);
  renumber(form, others, engineNames);
}

// Its model and effort stay in the form: leaving the chain must not discard a pin.
export function removeFromChain(form, name, engineNames) {
  renumber(form, chainRows(form, engineNames).used.filter(entry => entry !== name), engineNames);
}

// ─── rows: adding, changing and taking out an engine ───────────────────────
// A row is one engine a role tries. A row added here is filled with the model and
// effort that engine would use for the role's profile, as real values in the form,
// so what the row shows is what is written and what runs — the role does not lean on
// a default the page never displays. `inherit` has neither, so gets neither.

const fillRow = (form, name, config, profile) => {
  if (name === 'inherit') return;
  const block = config.engines?.[name] ?? {};
  fill(form, 'models', name, block.models?.[profile]);
  fill(form, 'effort', name, block.effort?.[profile]);
};

export function addToChain(form, name, config, profile, engineNames) {
  if (chainRows(form, engineNames).used.includes(name)) return;
  placeInChain(form, name, Infinity, engineNames);
  fillRow(form, name, config, profile);
}

// The engines one row's dropdown may show: its own, and any not used by another row.
export function enginesForRow(form, name, engineNames) {
  const { used } = chainRows(form, engineNames);
  return rowNames(engineNames).filter(entry => entry === name || !used.includes(entry));
}

// What the "add" button adds: a real engine before `inherit`, none once all are used.
export function nextUnusedEngine(form, engineNames) {
  const { used } = chainRows(form, engineNames);
  return [...engineNames, 'inherit'].find(name => !used.includes(name)) ?? null;
}

// Swaps the engine in a row, keeping its place in the order. What the engine it
// leaves had pinned stays in the form, as it does when a row is taken out.
export function replaceEngine(form, from, to, config, profile, engineNames) {
  const { used } = chainRows(form, engineNames);
  const at = used.indexOf(from);
  if (at === -1 || used.includes(to)) return;
  const next = [...used];
  next[at] = to;
  renumber(form, next, engineNames);
  fillRow(form, to, config, profile);
}

// Models the config names that the tool's own list no longer has: a model that was
// retired or renamed since the file was written. `lists` maps an engine to the ids
// its tool reports (aliases included); an engine with no list is never accused,
// because the absence of a list says nothing about the model. Where each is used is
// spelled the way the file spells it, so it can be found. With `specs`, an id the engine
// could never run is left out: it is not retired or renamed, it is on the wrong engine,
// and foreignModels says so — telling a person to "pick another" would be the wrong advice.
export function staleModels(config, lists, specs = null) {
  const found = new Map();
  const note = (engine, id, where) => {
    if (typeof id !== 'string' || !id.trim() || id === 'inherit' || !lists[engine] || lists[engine].includes(id)) return;
    if (specs && specs[engine] && !modelFits(specs[engine], id.trim())) return;
    const key = `${engine} ${id}`;
    if (!found.has(key)) found.set(key, { engine, id, where: [] });
    found.get(key).where.push(where);
  };
  for (const [engine, block] of Object.entries(config.engines ?? {})) {
    for (const [profile, id] of Object.entries(block?.models ?? {})) note(engine, id, `engines.${engine}.models.${profile}`);
  }
  for (const [role, value] of Object.entries(config.roles ?? {})) {
    for (const [engine, id] of Object.entries(value?.models ?? {})) note(engine, id, `roles.${role}.models.${engine}`);
  }
  return [...found.values()];
}
