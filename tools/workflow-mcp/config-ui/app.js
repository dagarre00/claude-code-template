// The page. It builds the DOM from what the server reports about this project and
// keeps one rule: every edit is checked by the server with the dispatcher's own
// validator before Save is allowed, so nothing is written that dispatch would
// refuse. What each role's form means lives in model.mjs, which the tests cover.
import { addToChain, assembleConfig, chainRows, completeShape, effectiveChain, enginesForRow, findUnknownKeys, foreignModels,
  linesToList, listToLines, modelChoices, nextUnusedEngine, placeInChain, removeFromChain, replaceEngine, roleToForm, staleModels }
  from './model.mjs';
import { explainMisfit, modelFits } from './model-fit.mjs';

const token = new URLSearchParams(location.search).get('t') ?? '';
const $ = id => document.getElementById(id);
const app = $('app'), statusEl = $('status'), saveButton = $('save'), reloadButton = $('reload');

let S = null;   // everything the page knows; replaced wholesale by load()
let seq = 0;    // orders validation replies, so a slow one cannot overwrite a newer one
let timer = 0;

async function api(path, body) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-Config-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? `HTTP ${res.status}`), { status: res.status });
  return json;
}

// Text goes in as text, never markup: role descriptions and config values come
// from files, and a page that writes the config must not run what it reads.
const el = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...kids.flat().filter(kid => kid != null && kid !== false));
  return node;
};
let ids = 0;
const field = (label, control, help) => {
  control.id ||= `f${++ids}`;
  return el('div', { class: 'field' }, el('label', { htmlFor: control.id }, label),
    help && el('p', { class: 'help' }, help), control);
};
const select = (options, value, onchange) => {
  const node = el('select', {}, options.map(([v, text]) => el('option', { value: v, selected: v === value }, text)));
  node.addEventListener('change', () => onchange(node.value));
  return node;
};
const textInput = (value, oninput, props = {}) => {
  const node = el('input', { type: 'text', value: value ?? '', spellcheck: false, ...props });
  node.addEventListener('input', () => oninput(node.value));
  return node;
};
// A model is chosen from a list: the ids the engine's adapter suggests plus any the
// config already uses for it (modelChoices). The list is a convenience, not a
// whitelist of names — model names change often — so the last entry, "Other…", opens
// a box to type one. What it cannot do is offer or accept another engine's model:
// each engine runs only ids with its own prefixes (model-fit.mjs), which the loader
// enforces, so a typed id that does not fit is marked here and Save stays off. The
// first entry is blank: no pin, so the engine's default applies (`blank` says which).
// "__other__" cannot be mistaken for a model, since an id may not start with an underscore.
const OTHER = '__other__';

// Whether the engine can run this id — the rule dispatch applies, on the copy the server sent.
const fits = (engine, id) => !id || modelFits(S.meta.engines[engine], id);
const misfit = (engine, id) => explainMisfit(S.meta.engines, engine, id);

// What the page offers for an engine: the models its tool reported when asked
// (S.live, filled by fetchModels), else the built-in list, plus any aliases it accepts.
const liveModels = engine => (S.live?.[engine]?.ok ? S.live[engine].models : null);
const suggestedModels = engine => [...(liveModels(engine)?.map(model => model.id) ?? S.meta.engines[engine].knownModels),
  ...Object.keys(S.meta.engines[engine].modelAliases ?? {})];
function modelLabel(engine, id) {
  const live = liveModels(engine);
  const known = live?.find(model => model.id === id);
  const alias = S.meta.engines[engine].modelAliases?.[id];
  // A tool's display name is shown only when it says something the id does not:
  // "GPT-5.6-Sol" beside gpt-5.6-sol is noise, "Claude Sonnet 4.6 (Thinking)" is not.
  const plain = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [id, known && plain(known.label) !== plain(id) ? `— ${known.label}` : '', alias ? `— ${alias}` : '',
    !fits(engine, id) ? `✖ not ${/^[aeiou]/i.test(engine) ? 'an' : 'a'} ${engine} model — it will be refused`
      : live && !known && !alias ? '⚠ not in the tool’s current list' : ''].filter(Boolean).join(' ');
}

function modelPicker(engine, initial, onpick, label, blank) {
  let value = initial ?? '';
  let typing = false;   // "Other…" is chosen and the box is open
  const select = el('select', { 'aria-label': label });
  const box = el('input', { type: 'text', spellcheck: false, placeholder: 'model id', 'aria-label': `${label} — type an id`, hidden: true });
  const warning = el('p', { class: 'misfit', role: 'alert', hidden: true });
  const wrap = el('div', { class: 'model-pick' }, select, box, warning);

  wrap.sync = (config, blankText = blank) => {
    blank = blankText;
    const ids = modelChoices(engine, config, suggestedModels(engine), value, S.meta.engines);
    select.replaceChildren(el('option', { value: '' }, blank), ...ids.map(id => el('option', { value: id }, modelLabel(engine, id))),
      el('option', { value: OTHER }, 'Other…'));
    select.value = typing ? OTHER : value;
    box.hidden = !typing;
    // Said where the value is, not only in the status bar: the row that is wrong is the row that shows it.
    const wrong = !fits(engine, value);
    warning.hidden = !wrong;
    warning.textContent = wrong ? misfit(engine, value) : '';
    select.setAttribute('aria-invalid', String(wrong && !typing));
    box.setAttribute('aria-invalid', String(wrong && typing));
  };
  select.addEventListener('change', () => {
    if (select.value === OTHER) { typing = true; box.hidden = false; box.value = ''; box.focus(); return; }
    typing = false; box.hidden = true; value = select.value; onpick(value);
  });
  box.addEventListener('input', () => { value = box.value.trim(); onpick(value); });
  // Leaving the box turns what was typed into an ordinary entry — or, if nothing was
  // typed, puts the list back on what it was showing.
  box.addEventListener('blur', () => { typing = false; wrap.sync(current()); });
  wrap.sync(current());
  return wrap;
}
const listBox = (list, oninput) => {
  const node = el('textarea', { value: listToLines(list), spellcheck: false });
  node.addEventListener('input', () => oninput(linesToList(node.value)));
  return node;
};

const current = () => assembleConfig(S.working, S.forms, S.engineNames, { drop: S.drop });

function setStatus(kind, text) { statusEl.className = kind; statusEl.textContent = text; }
function updateBar() {
  saveButton.disabled = !(S.dirty && S.valid);
  if (!S.valid) setStatus('bad', `✖ ${S.error}`);
  else if (S.dirty) setStatus('ok', '✔ Valid — you have unsaved changes');
  else setStatus('', 'No changes');
}

function changed() {
  S.dirty = true; S.note = null; S.conflict = null;
  const config = current();
  S.refreshers.forEach(refresh => refresh(config));
  renderNotices();
  saveButton.disabled = true;
  setStatus('', 'Checking…');
  const mine = ++seq;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try { await api('/api/validate', { config }); S.valid = true; S.error = null; }
    catch (error) { S.valid = false; S.error = error.message; }
    if (mine === seq) updateBar();
  }, 250);
}

// ─── sections ──────────────────────────────────────────────────────────────

function renderNotices() {
  const known = new Set(S.meta.roles.map(role => role.name));
  const notes = [];
  if (S.note) notes.push(el('div', { class: 'banner good' }, S.note));
  if (S.conflict) {
    notes.push(el('div', { class: 'banner warn' }, S.conflict,
      el('button', { type: 'button', onclick: load }, 'Reload')));
  }
  // A setting this page has no field for. The loader rejects it, so without a way
  // to remove it here the error above could only be fixed in a text editor.
  for (const { path, key, where } of findUnknownKeys(current(), S.meta.keys)) {
    notes.push(el('div', { class: 'banner warn' },
      `“${key}” (${where}) is not a setting the workflow recognises — probably a typo — so it does nothing, and the loader rejects it.`,
      el('button', { type: 'button', onclick: () => {
        const holder = path.slice(0, -1).reduce((object, step) => object?.[step], S.working);
        if (holder) delete holder[key];
        changed();
      } }, 'Remove it')));
  }
  // A model kept under an engine that cannot run it — the loader refuses this, so it
  // is said here, with where it sits and whose model it is, and can be cleared in one
  // click (the engine then uses its own default) instead of hunted down by hand.
  for (const { engine, id, where, paths } of foreignModels(current(), S.meta.engines)) {
    notes.push(el('div', { class: 'banner bad' },
      `${where.join(', ')}: ${misfit(engine, id)} A worker launched that way would fail, so the file cannot be saved like this.`,
      el('button', { type: 'button', onclick: () => {
        for (const [area, name, , key] of paths) {
          // Engine defaults live in the working copy and role pins in the page's forms (or,
          // for a role with no form, in the working copy too); either way it becomes "no pin".
          if (area === 'engines') S.working.engines[name].models[key] = null;
          else if (S.forms[name]) S.forms[name].models[key] = '';
          else delete S.working.roles?.[name]?.models?.[key];
        }
        render();
        changed();
      } }, 'Clear it')));
  }
  const lists = Object.fromEntries(S.engineNames.filter(name => liveModels(name))
    .map(name => [name, [...liveModels(name).map(model => model.id), ...Object.keys(S.meta.engines[name].modelAliases ?? {})]]));
  for (const { engine, id, where } of staleModels(current(), lists, S.meta.engines)) {
    notes.push(el('div', { class: 'banner warn' },
      `“${id}” (${where.join(', ')}) is not in ${engine}’s current list of models — it may have been retired or renamed. Pick another from the dropdown.`));
  }
  if (S.meta.rolesError) {
    notes.push(el('div', { class: 'banner warn' },
      `Could not read the role files, so roles are not listed: ${S.meta.rolesError}`));
  } else {
    for (const name of Object.keys(current().roles ?? {}).filter(name => !known.has(name))) {
      notes.push(el('div', { class: 'banner warn' },
        `“${name}” is in the file but has no role file in .agents/roles/, so it does nothing.`,
        el('button', { type: 'button', onclick: () => { S.drop.push(name); changed(); } }, 'Remove it')));
    }
  }
  S.notices.replaceChildren(...notes);
}

function introCard() {
  return el('details', { class: 'card' },
    el('summary', {}, 'How this fits together'),
    el('p', { class: 'lede' }, 'Each worker role (planner, developer, …) runs on an ', el('b', {}, 'engine'),
      ' — one of the AI command-line tools installed here — with a ', el('b', {}, 'model'), ' and an ', el('b', {}, 'effort'),
      '. What you set on a role’s row is exactly what that role uses. A model belongs to its engine: each row offers only the models its own tool runs, and an id from another engine (a GPT model on Antigravity, say) is refused.'),
    el('ul', {},
      el('li', {}, el('b', {}, 'Roles'), ' — for each role, the engines it may use, top to bottom in the order they are tried: the first one installed here runs, the others are fallbacks. Each row has its own model and effort. Add a row with “+ Add an engine”.'),
      el('li', {}, el('b', {}, 'General'), ' — the engine a role uses when you have not chosen any for it.'),
      el('li', {}, el('b', {}, 'Engines'), ' — fallback defaults: the model and effort used where a row is left on “default”, or a role follows the default engine.')));
}

function generalCard() {
  const timeout = el('input', { type: 'number', min: 1, max: 86400, step: 1, value: S.working.workerTimeoutSeconds ?? '' });
  timeout.addEventListener('input', () => {
    S.working.workerTimeoutSeconds = timeout.value === '' ? null : Number(timeout.value);
    changed();
  });
  return el('section', {},
    el('h2', {}, 'General'),
    field('Default engine',
      select([['inherit', 'inherit — the tool I am running the workflow from'], ...S.engineNames.map(name => [name, name])],
        S.working.defaultEngine, value => { S.working.defaultEngine = value; changed(); }),
      'Used by any role that does not pick its own engine. “inherit” means Claude Code runs Claude workers, Codex runs Codex workers, and so on.'),
    field('Worker time limit (seconds)', timeout,
      'Only Antigravity workers use this today; Claude and Codex workers ignore it.'),
    el('div', { class: 'field' }, el('b', {}, 'Model lists'),
      (S.listLine = el('p', { class: 'help' })),
      el('button', { type: 'button', onclick: fetchModels }, 'Refresh model lists')));
}

// Where each dropdown's models came from, so a stale list is never a silent one.
function renderListStatus() {
  if (!S.listLine) return;
  S.listLine.textContent = S.listing ? 'Asking each tool which models it has…' : S.engineNames.map(name => {
    const info = S.live?.[name];
    if (info?.ok) return `${name}: ${info.models.length} models, read from the tool just now`;
    if (!S.meta.engines[name].canList) return `${name}: built-in list and aliases (its tool has no way to list models)`;
    return `${name}: built-in list — could not ask the tool${info?.reason ? ` (${info.reason})` : ''}`;
  }).join(' · ');
}

// Asks the server to run each tool's own list command, then refreshes every dropdown.
// A slow or failing tool leaves the built-in list in place; it never blocks editing.
async function fetchModels() {
  const mine = S;
  mine.listing = true;
  renderListStatus();
  try { mine.live = (await api('/api/models', {})).engines; } catch { mine.live = {}; }
  mine.listing = false;
  if (S !== mine) return;
  S.refreshers.forEach(refresh => refresh(current()));
  renderNotices();
  renderListStatus();
}

// The engine an in-flight drag is carrying. Module state rather than dataTransfer:
// a dragover cannot read the payload (browsers hide it until the drop), and the
// page needs to know during the drag whether a row is a valid target.
let dragging = null;

// One hue per role, by position, so neighbouring roles never share a colour. Spread
// around the wheel rather than stepped, so adjacent hues are as far apart as they
// can be; the CSS turns each into a light and a dark tint.
const ROLE_HUES = [210, 25, 145, 285, 340, 175, 50, 250];

function roleCard(role, index = 0) {
  const form = S.forms[role.name];
  const names = ['inherit', ...S.engineNames];
  const follow = el('input', { type: 'checkbox', checked: form.follow });
  const followText = el('span');
  const followNote = el('p', { class: 'help' });
  const now = el('div', { class: 'now' });
  const body = el('tbody');
  const table = el('div', { class: 'tablewrap' }, el('table', { class: 'engines' },
    el('thead', {}, el('tr', {}, ['', '#', 'Engine', 'Model', 'Effort', ''].map(text => el('th', {}, text)))), body));
  const add = el('button', { type: 'button', class: 'add' }, '+ Add an engine');
  let inputs = { models: {}, efforts: {} };   // rebuilt with the rows, read by refresh

  // Every structural edit ends here. A chain with nothing in it is not a chain, so
  // taking out the last engine hands the role back to the default engine — visibly,
  // through the checkbox — rather than leaving a config the loader would refuse.
  const commit = focusName => {
    if (!form.follow && !chainRows(form, S.engineNames).used.length) form.follow = true;
    follow.checked = form.follow;
    renderRows(focusName);
    changed();
  };

  follow.addEventListener('change', () => {
    form.follow = follow.checked;
    // Leaving "use the default" starts from what was in effect, its model and effort
    // written down as the row's own values rather than left to a default.
    if (!form.follow && !chainRows(form, S.engineNames).used.length) {
      const start = current().defaultEngine;
      addToChain(form, names.includes(start) ? start : 'inherit', current(), role.profile, S.engineNames);
    }
    renderRows();
    changed();
  });

  add.addEventListener('click', () => {
    const next = nextUnusedEngine(form, S.engineNames);
    if (!next) return;
    addToChain(form, next, current(), role.profile, S.engineNames);
    commit(next);
  });

  const clearMarks = () => body.querySelectorAll('.drop-before, .drop-after')
    .forEach(row => row.classList.remove('drop-before', 'drop-after'));
  const inLowerHalf = (event, row) => event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
  const carrying = () => dragging?.role === role.name && !form.follow;

  // Dropping on a row puts the engine before or after it, by which half it lands in.
  const accept = (tr, name) => {
    tr.addEventListener('dragover', event => {
      if (!carrying()) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      clearMarks();
      tr.classList.add(inLowerHalf(event, tr) ? 'drop-after' : 'drop-before');
    });
    tr.addEventListener('drop', event => {
      if (!carrying()) return;
      event.preventDefault();
      clearMarks();
      const moved = dragging.name;
      if (name === moved) return;
      const others = chainRows(form, S.engineNames).used.filter(entry => entry !== moved);
      const at = others.indexOf(name);
      placeInChain(form, moved, inLowerHalf(event, tr) ? at + 1 : at, S.engineNames);
      commit(moved);
    });
  };

  const engineRow = (name, position) => {
    const tr = el('tr', { class: 'used', 'data-engine': name });
    const handle = el('span', { class: 'handle', role: 'button', tabIndex: 0, draggable: true,
      title: 'Drag to reorder, or focus and press ↑ / ↓',
      'aria-label': `Move ${name}: drag it, or press the up or down arrow` }, '☰');
    handle.addEventListener('dragstart', event => {
      dragging = { role: role.name, name };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', name);   // Firefox starts no drag without a payload
      event.dataTransfer.setDragImage?.(tr, 0, 0);
      tr.classList.add('dragging');
    });
    handle.addEventListener('dragend', () => { dragging = null; clearMarks(); tr.classList.remove('dragging'); });
    // The keyboard route to the same edit, so the list is usable without a mouse.
    handle.addEventListener('keydown', event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const { used } = chainRows(form, S.engineNames);
      const target = used.indexOf(name) + (event.key === 'ArrowUp' ? -1 : 1);
      if (target < 0 || target > used.length - 1) return;
      placeInChain(form, name, target, S.engineNames);
      commit(name);
    });

    // Each row names its engine in a dropdown of the ones no other row uses.
    const engine = select(enginesForRow(form, name, S.engineNames)
      .map(entry => [entry, entry === 'inherit' ? 'inherit — the tool running the workflow' : entry]), name,
    to => { replaceEngine(form, name, to, current(), role.profile, S.engineNames); commit(to); });
    engine.setAttribute('aria-label', `Engine for row ${position + 1}`);

    const middle = name === 'inherit'
      ? [el('td', { colSpan: 2, class: 'help' }, 'no model of its own')]
      : [el('td', {}, (inputs.models[name] = modelPicker(name, form.models[name], value => { form.models[name] = value; changed(); },
          `Model for ${name}`, 'default'))),
        el('td', {}, (inputs.efforts[name] = select([['', ''], ...S.meta.engines[name].efforts.map(value => [value, value])],
          form.effort[name], value => { form.effort[name] = value; changed(); })))];
    if (name !== 'inherit') inputs.efforts[name].setAttribute('aria-label', `Effort for ${name}`);

    tr.append(el('td', { class: 'handlecell' }, handle), el('td', { class: 'order' }, String(position + 1)),
      el('td', {}, engine), ...middle,
      el('td', { class: 'actioncell' }, el('button', { type: 'button', onclick: () => { removeFromChain(form, name, S.engineNames); commit(); } }, 'Remove')));
    accept(tr, name);
    return tr;
  };

  function renderRows(focusName) {
    inputs = { models: {}, efforts: {} };
    // Following the default means the role has no rows of its own to show or order.
    const used = form.follow ? [] : chainRows(form, S.engineNames).used;
    body.replaceChildren(...used.map((name, position) => engineRow(name, position)));
    table.hidden = add.hidden = form.follow;
    followNote.hidden = !form.follow;
    add.disabled = nextUnusedEngine(form, S.engineNames) === null;
    refresh(current());
    if (focusName) body.querySelector(`[data-engine="${focusName}"] .handle`)?.focus();
  }

  function refresh(config) {
    followText.textContent = ` Use the default engine (currently ${config.defaultEngine})`;
    followNote.textContent = `Runs on the default engine, with the fallback model and effort for a “${role.profile}” role (shown below). Untick the box to choose this role’s own engines, models and effort.`;
    for (const name of Object.keys(inputs.models)) {
      const block = config.engines?.[name] ?? {};
      inputs.models[name].sync(config, `default (${block.models?.[role.profile] ?? 'the tool’s own default'})`);
      inputs.efforts[name].options[0].textContent = `default (${block.effort?.[role.profile] ?? 'none'})`;
    }
    const steps = effectiveChain(config, config.roles?.[role.name], role.profile);
    // Through `el`, not replaceChildren directly: a bare null there is rendered as the text "null".
    now.replaceChildren(el('span', {}, el('b', {}, 'Will run: '), steps.flatMap((step, i) => [
      i ? ' → ' : '',
      step.engine === 'inherit' ? 'the tool running the workflow' : el('span', {}, step.engine, ' · ',
        // A model this engine cannot run is what dispatch would refuse: red, not blue.
        el('span', { class: !fits(step.engine, step.model) ? 'misfit' : step.modelFrom === 'role' ? 'pin' : '' },
          step.model ?? 'its own default model', !fits(step.engine, step.model) && ' ✖'), ' · ',
        el('span', { class: step.effortFrom === 'role' ? 'pin' : '' }, step.effort ?? 'its own default effort'))
    ]), steps.length > 1 && el('div', { class: 'help' }, 'Later ones are used only when the earlier tool is not installed. Blue = set on this role.')));
  }

  S.refreshers.push(refresh);
  const card = el('div', { class: 'role tinted', style: `--hue: ${ROLE_HUES[index % ROLE_HUES.length]}` },
    el('header', {}, el('h3', {}, role.name), el('span', { class: 'tag' }, role.access), el('span', { class: 'help' }, role.description)),
    el('label', { class: 'follow' }, follow, followText),
    followNote, table, add, now);
  renderRows();
  return card;
}

function rolesCard() {
  return el('section', {},
    el('h2', {}, 'Roles'),
    el('p', { class: 'lede' }, 'Leave a role on the default engine, or choose its engines yourself: each row is an engine with its model and effort, and the top row runs first — the others only if the tool above is not installed. Press “+ Add an engine” for another row, drag ☰ (or focus it and press ↑ / ↓) to reorder, Remove to take one out. A model or effort left on “default” uses the fallback defaults under Engines. Changing a row’s engine never carries its model over: the model list is always that engine’s own.'),
    S.meta.roles.length ? S.meta.roles.map((role, index) => roleCard(role, index)) : el('p', { class: 'help' }, 'No roles found in .agents/roles/.'));
}

// The flags an engine's worker is launched with, read-only. The server builds this
// by running the adapters (engine-flags.mjs), so it is what is really passed — and
// it is deliberately not editable: the `guarantee` rows are what keeps a read-only
// role read-only and a worker from starting more workers.
const FLAG_KIND = { guarantee: 'guarantee', config: 'from your settings', plumbing: 'plumbing', hygiene: 'housekeeping' };

function flagsList(name) {
  const rows = S.meta.flags?.[name]?.rows ?? [];
  if (!rows.length) return null;
  const value = row => row.byAccess
    ? `read-only roles: ${row.byAccess['read-only']} · write roles: ${row.byAccess.write}`
    : (row.value || '—');
  return el('details', { class: 'flags' },
    el('summary', {}, `Flags every ${name} worker is launched with (fixed — ${rows.length})`),
    el('p', { class: 'help' }, 'Passed on every run and not editable here. The ones marked “guarantee” are what keeps read-only roles read-only, keeps a worker from starting more workers, and keeps the project’s own instructions out of its context. “From your settings” flags take their value from this page; the rest are what the harness needs to run a worker and read its report.'),
    el('div', { class: 'tablewrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Flag', 'Value', 'Kind', 'Why'].map(text => el('th', {}, text)))),
      el('tbody', {}, rows.map(row => el('tr', { class: `flag-${row.kind}` },
        el('td', {}, el('code', {}, row.label)),
        el('td', {}, value(row), row.when ? el('div', { class: 'help' }, row.when) : null),
        el('td', {}, el('span', { class: `tag kind-${row.kind}` }, FLAG_KIND[row.kind] ?? row.kind)),
        el('td', {}, row.why)))))));
}

function enginesCard() {
  const cards = S.engineNames.map(name => {
    const block = S.working.engines[name];
    const rows = S.meta.profiles.map(profile => el('tr', {},
      el('td', {}, profile, el('div', { class: 'help' },
        `roles of this kind: ${S.meta.roles.filter(role => role.profile === profile).map(role => role.name).join(', ') || 'none'}`)),
      el('td', {}, (() => {
        const picker = modelPicker(name, block.models[profile], value => { block.models[profile] = value || null; changed(); },
          `${name} model for ${profile}`, 'the tool’s own default');
        S.refreshers.push(config => picker.sync(config));   // so an id typed elsewhere is offered here too
        return picker;
      })()),
      el('td', {}, select([['', 'the tool’s own default'], ...S.meta.engines[name].efforts.map(value => [value, value])],
        block.effort[profile] ?? '', value => { block.effort[profile] = value || null; changed(); }))));
    const extras = name !== 'codex' ? [] : [
      ['toolOutputTokenLimit', 'Tool output limit (tokens)', 'Cap on how much of one file read or command output a Codex worker keeps. Blank = no cap.'],
      ['modelAutoCompactTokenLimit', 'Auto-compact at (tokens)', 'When a Codex worker summarizes its own history. Blank = Codex decides.']
    ].map(([key, label, help]) => {
      const input = el('input', { type: 'number', min: 1, step: 1, value: block[key] ?? '' });
      input.addEventListener('input', () => {
        if (input.value === '') delete block[key]; else block[key] = Number(input.value);
        changed();
      });
      return field(label, input, help);
    });
    return el('div', { class: 'role' },
      el('h3', {}, name),
      field('Program to launch', textInput(block.executable, value => { block.executable = value.trim(); changed(); }),
        'The real executable, by name or full path. .cmd and .bat shims are refused.'),
      el('div', { class: 'tablewrap' }, el('table', {},
        el('thead', {}, el('tr', {}, ['Kind of role', 'Default model', 'Default effort'].map(text => el('th', {}, text)))),
        el('tbody', {}, rows))),
      ...extras,
      flagsList(name));
  });
  return el('section', {},
    el('h2', {}, 'Engines — fallback defaults'),
    el('p', { class: 'lede' }, 'Where a role’s row is left on “default”, or the role follows the default engine, it gets the model and effort below. Roles come in three kinds — ',
      el('b', {}, 'reasoning'), ' (the strongest), ', el('b', {}, 'balanced'), ' and ', el('b', {}, 'fast'),
      ' — and each role’s kind is set in its own file (', el('code', {}, '.agents/roles/<role>.md'),
      '), not here. Anything you set on a role’s row wins over these.'),
    cards);
}

function advancedCard() {
  const optional = (key, list) => { if (list.length || key in S.working) S.working[key] = list; };
  const arch = () => (S.working.architecture ??= { command: null, rules: [] });
  return el('details', { class: 'card' },
    el('summary', {}, 'Safety and advanced'),
    field('Commands workers may run (one per line)',
      listBox(S.working.workerCommands, list => { S.working.workerCommands = list; changed(); }),
      'Matched literally, not as patterns: “npm test” allows exactly “npm test”. Anything chained or redirected (&&, |, ;, >) can never match. Keep it short.'),
    field('Setup commands for a fresh worktree (one per line)',
      listBox(S.working.worktreeSetup, list => { optional('worktreeSetup', list); changed(); }),
      'Run by you, the conductor, inside a new worktree before a worker starts — for example installing dependencies. Never given to workers, so these may chain with &&.'),
    field('Paths no worker may change (one per line)',
      listBox(S.working.protectedPaths, list => { optional('protectedPaths', list); changed(); }),
      'Relative to the project root. Applies even inside a path the worker was otherwise given to write.'),
    field('Architecture check command',
      textInput(S.working.architecture?.command, value => { arch().command = value.trim() || null; changed(); }),
      'The one command that fails when the layers in docs/wiki/architecture.md are broken. It is added to the workers’ allowed commands for you.'),
    field('Architecture rule files (one per line)',
      listBox(S.working.architecture?.rules, list => { arch().rules = list; changed(); }),
      'The files that define those rules. They are protected automatically.'));
}

function previewCard() {
  const pre = el('pre');
  S.refreshers.push(config => { pre.textContent = JSON.stringify(config, null, 2); });
  return el('details', { class: 'card' }, el('summary', {}, 'Show the file this will write'), pre);
}

function render() {
  S.refreshers = [];
  S.notices = el('div', { style: 'display:grid;gap:8px' });
  app.replaceChildren(S.notices, introCard(), generalCard(), rolesCard(), enginesCard(), advancedCard(), previewCard());
  const config = current();
  S.refreshers.forEach(refresh => refresh(config));
  renderNotices();
  renderListStatus();
}

// ─── loading and saving ────────────────────────────────────────────────────

function fatal(message) {
  saveButton.disabled = true;
  setStatus('bad', message);
  app.replaceChildren(el('div', { class: 'banner bad' }, message));
}

async function load() {
  clearTimeout(timer); seq++;
  setStatus('', 'Loading…');
  let data;
  try { data = await api('/api/config'); } catch (error) { return fatal(error.message); }
  $('path').textContent = data.path;
  if (data.parseError) return fatal(`${data.parseError}. Fix the file by hand, then reload this page.`);
  const engineNames = Object.keys(data.meta.engines);
  S = {
    etag: data.etag, meta: data.meta, engineNames, forms: {}, drop: [],
    working: completeShape(data.config, engineNames, data.meta.profiles),
    dirty: false, valid: !data.validationError, error: data.validationError, note: null, conflict: null,
    commands: JSON.stringify(data.config.workerCommands), refreshers: [], notices: null
  };
  for (const role of data.meta.roles) S.forms[role.name] = roleToForm(S.working.roles?.[role.name], engineNames);
  render();
  fetchModels();
  if (data.validationError) setStatus('bad', `✖ The file on disk is not valid: ${data.validationError}`);
  else updateBar();
}

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  const config = current();
  try {
    const { etag } = await api('/api/save', { config, etag: S.etag });
    const commandsChanged = JSON.stringify(config.workerCommands) !== S.commands;
    Object.assign(S, { etag, working: structuredClone(config), drop: [], dirty: false, valid: true, error: null,
      commands: JSON.stringify(config.workerCommands), conflict: null,
      note: 'Saved. The next dispatch uses it — no restart needed.'
        + (commandsChanged ? ' You changed the commands workers may run: Antigravity needs a one-time grant for new ones — the workflow’s “check” reports it and “grant_antigravity_setup” applies it.' : '') });
    renderNotices();
    updateBar();
  } catch (error) {
    if (error.status === 409) { S.conflict = error.message; renderNotices(); updateBar(); }
    else { S.valid = false; S.error = error.message; updateBar(); }
  }
});

reloadButton.addEventListener('click', () => {
  if (S?.dirty && !confirm('Discard your unsaved changes?')) return;
  load();
});
window.addEventListener('beforeunload', event => { if (S?.dirty) { event.preventDefault(); event.returnValue = ''; } });

load();
