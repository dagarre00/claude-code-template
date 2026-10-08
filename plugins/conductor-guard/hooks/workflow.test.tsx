import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const OK = { exitCode: 0, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
const PANE = {
  title: 'Workflow',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as const
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

const FILES: Record<string, string> = {
  '.claude/rules/behavioral.md': '# Rules',
  'docs/wiki/todos.md': '## Now (P0 — next)\n- [ ] Login lockout\n- [ ] Session expiry\n## Later (P2)\n_(Empty.)_\n',
}

// A repository on feat/login: git answers by subcommand and records what ran;
// toasts and opened panes are recorded too.
function repo(on: On, { porcelain = '' } = {}) {
  const ran: string[] = []
  const toasts: string[] = []
  const opened: string[] = []
  const focused: string[] = []
  const escapable: string[] = []
  const git: Record<string, string> = {
    'rev-parse': 'feat/login\n',
    'rev-list': '1\n',
    'status --porcelain': porcelain,
    'branch --format': '  develop\n* feat/login\n',
    'log --oneline': 'ae8fe1c demo: queue todos\n',
    switch: '',
  }
  on('process.run', ($, e) => {
    const sub = e.argv.slice(1).join(' ')
    ran.push(sub)
    const key = Object.keys(git).find(k => sub.startsWith(k))
    return { value: key === undefined ? { ...OK, exitCode: 128, stdout: '' } : { ...OK, stdout: git[key]! } }
  })
  const named = (path: string) => Object.keys(FILES).find(n => path.replaceAll('\\', '/').endsWith(n))
  on('fs.read', ($, e) => {
    const name = named(e.path)
    if (name === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: FILES[name]! }
  })
  on('fs.exists', ($, e) => ({ value: named(e.path) !== undefined }))
  on('fs.list', () => ({ value: [] }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    opened.push(e.id)
    if (e.focus) focused.push(e.id)
    if (e.closeOnEscape) escapable.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  return { ran, toasts, opened, focused, escapable }
}

type Kit = Parameters<Parameters<typeof test>[1]>[0]

// The session start reads the repository; the pane draws what it read.
async function mountPane($: Kit, requestId = 'workflow') {
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  return $.ui.mount({ plugin: 'conductor-guard', surface: 'terminal', component: 'Pane', requestId, props: PANE })
}

test('drawing the workflow pane runs no git, so a redraw cannot abort one', async ($, on) => {
  const w = repo(on)
  // Mounting the band waits out the session start's own read of the repository.
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.ui.mount({ plugin: 'conductor-guard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const before = w.ran.length

  const ui = await $.ui.mount({ plugin: 'conductor-guard', surface: 'terminal', component: 'Pane', requestId: 'workflow', props: PANE })

  expect(await ui.find({ text: /develop/ })).toBeDefined()
  expect(w.ran.slice(before)).toEqual([])
})

test('the band carries a menu button that opens the wiki and workflow panes, the workflow one focused', async ($, on) => {
  const w = repo(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'conductor-guard', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  await ui.press({ key: 'menu' })

  expect(w.opened).toEqual(['wiki-nav', 'workflow'])
  expect(w.focused).toEqual(['workflow'])
  // Esc on either goes the way their close mark does.
  expect(w.escapable).toEqual(['wiki-nav', 'workflow'])
})

test('the workflow pane lists branches, open todos and the status', async ($, on) => {
  repo(on, { porcelain: '?? demo-wip.ts\n' })
  const ui = await mountPane($)

  expect(await ui.find({ key: 'branch:feat/login' })).toMatchObject({ text: '● feat/login' })
  expect(await ui.find({ key: 'branch:develop' })).toMatchObject({ text: '  develop' })
  expect(await ui.find({ text: /^P0 {2}Login lockout$/ })).toBeDefined()
  expect(await ui.find({ text: /^P0 {2}Session expiry$/ })).toBeDefined()
  expect(await ui.find({ text: /^\?\? demo-wip\.ts$/ })).toBeDefined()
  expect(await ui.find({ text: /^ae8fe1c demo: queue todos$/ })).toBeDefined()
})

test('picking a branch over a clean tree switches to it', async ($, on) => {
  const w = repo(on)
  const ui = await mountPane($)

  await ui.press({ key: 'branch:develop' })

  expect(w.ran).toContain('switch develop')
})

test('picking a branch over a dirty tree is refused, naming rule 21', async ($, on) => {
  const w = repo(on, { porcelain: ' M src/a.ts\n' })
  const ui = await mountPane($)

  await ui.press({ key: 'branch:develop' })

  expect(w.ran.some(r => r.startsWith('switch'))).toBe(false)
  expect(w.toasts.join('\n')).toMatch(/rule 21/)
})

test('picking the current branch does nothing', async ($, on) => {
  const w = repo(on)
  const ui = await mountPane($)

  await ui.press({ key: 'branch:feat/login' })

  expect(w.ran.some(r => r.startsWith('switch'))).toBe(false)
})

test('pressing a todo opens todos.md in the wiki pane', async ($, on) => {
  const w = repo(on)
  const ui = await mountPane($)

  await ui.press({ key: 'todo:0' })

  expect(w.focused).toEqual(['wiki-nav'])
  expect(w.escapable).toEqual(['wiki-nav'])
  const nav = await $.ui.mount({ plugin: 'conductor-guard', surface: 'terminal', component: 'Pane', requestId: 'wiki-nav', props: PANE })
  expect((await nav.find({ type: 'Markdown' }))?.text).toMatch(/Login lockout/)
})

test('the workflow pane has no wiki row: the menu opens the wiki pane beside it', async ($, on) => {
  repo(on)
  const ui = await mountPane($)

  expect(await ui.find({ key: 'wiki' })).toBeUndefined()
})
