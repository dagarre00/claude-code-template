import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const OK = { exitCode: 0, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
const PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

// A repository on feat/auth with one unpushed commit and one changed file.
function repo(on: On, git: Record<string, string>, files: Record<string, string>) {
  on('process.run', ($, e) => {
    const sub = e.argv.slice(1).join(' ')
    const key = Object.keys(git).find(k => sub.startsWith(k))
    return { value: key === undefined ? { ...OK, exitCode: 128, stdout: '' } : { ...OK, stdout: git[key]! } }
  })
  const named = (path: string) => Object.keys(files).find(n => path.replaceAll('\\', '/').endsWith(n))
  on('fs.read', ($, e) => {
    const name = named(e.path)
    if (name === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: files[name]! }
  })
  on('fs.exists', ($, e) => ({ value: named(e.path) !== undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // The engine's own band beneath the plugin: an empty box.
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
}

const GIT = { 'rev-parse': 'feat/auth\n', 'rev-list': '1\n', 'status --porcelain': ' M src/a.ts\n' }
const FILES = {
  '.claude/rules/behavioral.md': '# Rules',
  'docs/wiki/entities/auth.md': '- [x] B1: When a, b.\n- [ ] B2: When c, d.\n',
  'docs/wiki/todos.md': '`FINDINGS_MAX = 40`\n## Now (P0 — next)\n_(Empty.)_\n## Later (P2)\n- [ ] P2 x [adversary]\n',
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the band shows the cycle's state on ${surface}`, async ($, on) => {
    repo(on, GIT, FILES)
    await $.session.start({ cwd: '/p', surface, isInteractive: true })

    const ui = await $.ui.mount({ plugin: 'conductor-guard', surface, component: 'AbovePrompt', props: PROPS })

    const shown = (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' ')
    expect(shown).toBe(' feat/auth  auth 1/2 cases · 1 unpushed · 1 changed · 1 P2 todos · backlog 1/40')
  })
}

test('the branch sits on a colored chip and each part keeps its own color', async ($, on) => {
  repo(on, GIT, FILES)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ plugin: 'conductor-guard', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

  // find matches by inclusion, outermost first: anchor to reach the part itself.
  expect(await ui.find({ type: 'Text', text: /^ feat\/auth $/ })).toMatchObject({ props: { backgroundColor: 'claude', color: 'inverseText' } })
  expect(await ui.find({ type: 'Text', text: /^· 1 changed$/ })).toMatchObject({ props: { color: 'warning' } })
})

test('outside a repository the band stays empty', async ($, on) => {
  repo(on, {}, {})
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ plugin: 'conductor-guard', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

  expect(await ui.find({ text: /cases|changed|clean/ })).toBeUndefined()
})

test('a repository without the workflow shows no band', async ($, on) => {
  const { '.claude/rules/behavioral.md': _, ...plain } = FILES
  repo(on, GIT, plain)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ plugin: 'conductor-guard', surface: 'terminal', component: 'AbovePrompt', props: PROPS })

  expect(await ui.find({ text: /feat\/auth/ })).toBeUndefined()
})
