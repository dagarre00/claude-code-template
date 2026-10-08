import { describe, expect, test } from 'claude-code/testing'

import {
  bandText,
  countBacklog,
  countCases,
  destructiveGit,
  entitySlug,
  isCommit,
  isForbiddenDispatch,
  isRawSource,
  topTodos,
} from './rules'

describe('rule 11: raw sources', () => {
  test('a path under docs/raw/ is a raw source, on any separator', () => {
    expect(isRawSource('docs/raw/interviews/a.md')).toBe(true)
    expect(isRawSource('C:\\proj\\docs\\raw\\research\\b.md')).toBe(true)
    expect(isRawSource('/home/me/proj/docs/raw/x.md')).toBe(true)
  })

  test('the wiki and look-alike folders are not', () => {
    expect(isRawSource('docs/wiki/log.md')).toBe(false)
    expect(isRawSource('docs/rawish/x.md')).toBe(false)
    expect(isRawSource('mydocs/raw/x.md')).toBe(false)
  })
})

describe('rule 21: destructive git', () => {
  test('names each operation that discards working-tree changes', () => {
    expect(destructiveGit('git stash')).toBe('git stash')
    expect(destructiveGit('git stash push -m wip')).toBe('git stash')
    expect(destructiveGit('git reset --hard HEAD~1')).toBe('git reset --hard')
    expect(destructiveGit('git checkout -- src/a.ts')).toBe('git checkout --')
    expect(destructiveGit('git checkout .')).toBe('git checkout .')
    expect(destructiveGit('git restore src/a.ts')).toBe('git restore')
    expect(destructiveGit('git clean -fd')).toBe('git clean')
    expect(destructiveGit('git status && git reset --hard')).toBe('git reset --hard')
  })

  test('leaves read-only and index-only operations alone', () => {
    expect(destructiveGit('git stash list')).toBeUndefined()
    expect(destructiveGit('git stash show -p')).toBeUndefined()
    expect(destructiveGit('git reset HEAD a.ts')).toBeUndefined()
    expect(destructiveGit('git restore --staged a.ts')).toBeUndefined()
    expect(destructiveGit('git checkout develop')).toBeUndefined()
    expect(destructiveGit('git clean -n')).toBeUndefined()
    expect(destructiveGit('echo git reset --hard is forbidden')).toBeUndefined()
  })
})

describe('rule 10: dispatch', () => {
  test('a fork, general-purpose or unnamed agent carries the conductor context', () => {
    expect(isForbiddenDispatch('fork')).toBe(true)
    expect(isForbiddenDispatch('general-purpose')).toBe(true)
    expect(isForbiddenDispatch(undefined)).toBe(true)
  })

  test('a named role or a search agent does not', () => {
    expect(isForbiddenDispatch('developer')).toBe(false)
    expect(isForbiddenDispatch('Explore')).toBe(false)
  })
})

describe('rule 19: commits', () => {
  test('a commit is recognised, a dry run is not', () => {
    expect(isCommit('git commit -m "x"')).toBe(true)
    expect(isCommit('git add . && git commit -qm x')).toBe(true)
    expect(isCommit('git commit --dry-run')).toBe(false)
    expect(isCommit('git log --oneline')).toBe(false)
  })
})

describe('band', () => {
  test('the entity slug comes from a code branch', () => {
    expect(entitySlug('feat/auth-login')).toBe('auth-login')
    expect(entitySlug('fix/race-on-submit')).toBe('race-on-submit')
    expect(entitySlug('develop')).toBeUndefined()
    expect(entitySlug('docs/readme')).toBeUndefined()
  })

  test('cases count every Behavior line, done only when [x]', () => {
    const page = [
      '## Behavior',
      '- [x] B1: When a, then b.',
      '- [~] B2: When c, then d.',
      '- [ ] B3: When e, then f.',
      '- [ ] not a case',
    ].join('\n')
    expect(countCases(page)).toEqual({ done: 1, total: 3 })
  })

  test('the backlog counts open [adversary] todos and reads FINDINGS_MAX', () => {
    const todos = [
      '**`FINDINGS_MAX = 25`.** Filing is the default',
      '- [ ] P2 fix x [adversary]',
      '- [x] P2 fix y [adversary]',
      '- [ ] P1 [adversary] fix z',
      '- [ ] P1 plain todo',
    ].join('\n')
    expect(countBacklog(todos)).toEqual({ open: 2, max: 25 })
  })

  test('the top todos are the open items of the highest priority that has any', () => {
    const todos = (p0: string, p1: string) =>
      ['## P0 saturation threshold', '- [ ] not a todo', '## Now (P0 — next)', p0, '## Next (P1)', p1, '## Later (P2)', '- [ ] P2 c'].join('\n')
    expect(topTodos(todos('- [ ] a\n- [x] done\n- [ ] [adversary] b', '- [ ] c'))).toEqual({ priority: 'P0', open: 2 })
    expect(topTodos(todos('_(Empty.)_', '- [ ] c'))).toEqual({ priority: 'P1', open: 1 })
    expect(topTodos(todos('_(Empty.)_', '_(Empty.)_'))).toEqual({ priority: 'P2', open: 1 })
    expect(topTodos('## Now (P0 — next)\n_(Empty.)_')).toBeNull()
  })

  test('the text joins what is known and drops what is not', () => {
    expect(
      bandText({
        branch: 'feat/auth',
        unpushed: 2,
        dirty: 3,
        cases: { slug: 'auth', done: 1, total: 4 },
        todos: { priority: 'P0', open: 3 },
        backlog: { open: 12, max: 40 },
      }),
    ).toBe('feat/auth · auth 1/4 cases · 2 unpushed · 3 changed · 3 P0 todos · backlog 12/40')

    expect(
      bandText({ branch: 'develop', unpushed: null, dirty: 0, cases: null, todos: null, backlog: null }),
    ).toBe('develop · no upstream · clean')
  })
})
