import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const PROPS = {
  title: 'Wiki',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as const

const FILES: Record<string, string> = {
  'docs/wiki/requirements.md': '---\ntype: reference\n---\n\n# Requirements\n\nR1: links are saved.',
  'docs/wiki/todos.md': '## Now (P0 — next)\n- [ ] fix a\n- [ ] fix b\n',
  'docs/wiki/entities/README.md': '# Entities',
  'docs/wiki/entities/auth.md': '# Auth\n- [x] B1: When a, b.\n- [ ] B2: When c, d.\n',
  'docs/wiki/decisions/0001-sqlite.md': '# Use SQLite',
  'docs/wiki/gotchas.md': Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n'),
}

const slashed = (path: string) => path.replaceAll('\\', '/')
const named = (path: string) => Object.keys(FILES).find(n => slashed(path).endsWith(n))

// A wiki on disk, and nothing beneath the plugin's own drawing.
function wiki(on: On) {
  on('fs.read', ($, e) => {
    const name = named(e.path)
    if (name === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: FILES[name]! }
  })
  on('fs.exists', ($, e) => ({ value: named(e.path) !== undefined }))
  on('fs.list', ($, e) => {
    const dir = `${slashed(e.path ?? '')}/`
    const value = Object.keys(FILES)
      .filter(n => dir.endsWith(`${n.slice(0, n.lastIndexOf('/'))}/`))
      .map(n => ({ name: n.slice(n.lastIndexOf('/') + 1), kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false }))
    return { value }
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  // The engine beneath answers a scroll the plugin passes on, moving nothing.
  on('ui.scroll', () => ({}))
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the navigator lists the spec, entities and decisions on ${surface}`, async ($, on) => {
    wiki(on)
    const ui = await $.ui.mount({ plugin: 'conductor-guard', surface, component: 'Pane', requestId: 'wiki-nav', props: PROPS })

    expect(await ui.find({ text: 'Requirements' })).toBeDefined()
    expect(await ui.find({ text: 'Todos — 2 P0' })).toBeDefined()
    expect(await ui.find({ text: 'auth — 1/2 cases' })).toBeDefined()
    expect(await ui.find({ text: 'Use SQLite' })).toBeDefined()
    expect(await ui.find({ text: 'Architecture' })).toBeUndefined()
    expect(await ui.find({ text: /README/ })).toBeUndefined()
  })

  test(`pressing a page shows it without its frontmatter, and back returns on ${surface}`, async ($, on) => {
    wiki(on)
    const ui = await $.ui.mount({ plugin: 'conductor-guard', surface, component: 'Pane', requestId: 'wiki-nav', props: PROPS })

    await ui.press({ key: 'docs/wiki/requirements.md' })
    const page = await ui.find({ type: 'Markdown' })
    expect(page?.text).toMatch(/R1: links are saved/)
    expect(page?.text).not.toMatch(/type: reference/)

    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Markdown' })).toBeUndefined()
    expect(await ui.find({ text: 'Todos — 2 P0' })).toBeDefined()
  })
}

test('a page scrolls inside a window under a back row that stays put', async ($, on) => {
  wiki(on)
  const ui = await $.ui.mount({ plugin: 'conductor-guard', surface: 'terminal', component: 'Pane', requestId: 'wiki-nav', props: PROPS })
  await ui.press({ key: 'docs/wiki/gotchas.md' })

  // The tree is the pane's height: the back row and a window of the 29 rows left.
  expect(await ui.find({ key: 'page-window' })).toMatchObject({ props: { height: 29, overflow: 'hidden' } })
  expect(await ui.find({ key: 'page-body' })).toMatchObject({ props: { marginTop: 0 } })

  // The person's wheel and keys, as the engine raises them over the pane.
  const wheel = (by: number) =>
    $.ui.scroll({ component: 'Pane', requestId: 'wiki-nav', offset: 0, by, bodyRows: 30, contentRows: 30, origin: { kind: 'person' } } as never)
  await wheel(3)
  expect(await ui.find({ key: 'page-body' })).toMatchObject({ props: { marginTop: -3 } })
  await wheel(-10)
  expect(await ui.find({ key: 'page-body' })).toMatchObject({ props: { marginTop: 0 } })
  await wheel(1000)

  // 60 lines plus the margin in a 29-row window: the last window starts at row 33.
  expect(await ui.find({ key: 'page-body' })).toMatchObject({ props: { marginTop: -33 } })
  expect(await ui.find({ key: 'back' })).toBeDefined()

  await ui.press({ key: 'back' })
  await ui.press({ key: 'docs/wiki/gotchas.md' })
  expect(await ui.find({ key: 'page-body' })).toMatchObject({ props: { marginTop: 0 } })
})
