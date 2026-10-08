import { describe, expect, test } from 'claude-code/testing'

import { entityLabel, isEntityPage, pageBody, pageRows, scrolledTo, todosLabel } from './nav'

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

describe('page scrolling', () => {
  test('a page is as many rows as its lines take wrapped at the width, plus a margin', () => {
    expect(pageRows('a\n\nb', 10)).toBe(3 + 2)
    expect(pageRows('x'.repeat(25), 10)).toBe(3 + 2)
  })

  test('a scroll moves by its rows, never above the top nor past the last window', () => {
    // 20 rows in a window of 5: the last window starts at row 15.
    expect(scrolledTo(0, 3, 20, 5)).toBe(3)
    expect(scrolledTo(2, -5, 20, 5)).toBe(0)
    expect(scrolledTo(14, 10, 20, 5)).toBe(15)
    expect(scrolledTo(0, 10, 4, 5)).toBe(0)
  })
})
