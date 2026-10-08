import { describe, expect, test } from 'claude-code/testing'

import { entityLabel, isEntityPage, pageBody, todosLabel } from './nav'

describe('wiki navigator', () => {
  test('a page body drops the frontmatter and keeps the rest', () => {
    expect(pageBody('---\ntype: reference\ntags: []\n---\n\n# Todos\n\nbody')).toBe('# Todos\n\nbody')
    expect(pageBody('# No frontmatter')).toBe('# No frontmatter')
  })

  test('an entity is labelled by its slug and its Behavior cases', () => {
    expect(entityLabel('auth.md', '- [x] B1: When a, b.\n- [ ] B2: When c, d.')).toBe('auth — 1/2 cases')
    expect(entityLabel('draft.md', 'no cases yet')).toBe('draft — no cases')
  })

  test('the entities folder index is not an entity', () => {
    expect(isEntityPage('auth.md')).toBe(true)
    expect(isEntityPage('README.md')).toBe(false)
    expect(isEntityPage('notes.txt')).toBe(false)
  })

  test('todos are labelled by the top priority that has open items', () => {
    expect(todosLabel('## Now (P0 — next)\n- [ ] a\n- [ ] b')).toBe('Todos — 2 P0')
    expect(todosLabel('## Now (P0 — next)\n_(Empty.)_')).toBe('Todos — empty')
  })
})
