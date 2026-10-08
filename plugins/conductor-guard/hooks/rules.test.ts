import { describe, expect, test } from 'claude-code/testing'

import {
  bandParts,
  bandText,
  countBacklog,
  countCases,
  destructiveGit,
  entitySlug,
  isCommit,
  isForbiddenDispatch,
  isRawSource,
  openTodos,
  topTodos,
  readUsage,
  usageParts,
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
    expect(destructiveGit('git stash push --include-untracked')).toBe('git stash')
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

  test("passes the workflow's own forms: the Red check's restores and the tagged stash", () => {
    expect(destructiveGit("git restore --source=HEAD~1 --staged --worktree -- . ':(exclude)test'")).toBeUndefined()
    expect(destructiveGit('git restore --source=HEAD --staged --worktree -- .')).toBeUndefined()
    expect(destructiveGit('git stash push -u -m "wip: tag"')).toBeUndefined()
    expect(destructiveGit('git stash apply 1a2b3c')).toBeUndefined()
    expect(destructiveGit('git stash push -u')).toBe('git stash')
    expect(destructiveGit('git stash pop')).toBe('git stash')
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

  test('the open todos are listed with their priority, in queue order', () => {
    const todos = [
      '## P0 saturation threshold', '- [ ] not a todo',
      '## Now (P0 — next)', '- [ ] Login lockout', '- [x] shipped', '_(Empty.)_',
      '## Next (P1)', '_(Empty.)_',
      '## Later (P2)', '- [ ] [adversary] timing leak — minor/security',
      '## Backlog', '- [ ] someday',
    ].join('\n')
    expect(openTodos(todos)).toEqual([
      { priority: 'P0', text: 'Login lockout' },
      { priority: 'P2', text: '[adversary] timing leak — minor/security' },
    ])
    expect(openTodos('## Now (P0 — next)\r\n- [ ] crlf\r\n')).toEqual([{ priority: 'P0', text: 'crlf' }])
  })

  test('each part takes a theme color that says whether it needs attention', () => {
    const colors = (band: Parameters<typeof bandParts>[0]) => bandParts(band).map(p => p.color)
    const base = { branch: 'feat/auth', unpushed: 0, dirty: 0, cases: null, todos: null, backlog: null }

    expect(
      colors({
        ...base,
        unpushed: 2,
        dirty: 3,
        cases: { slug: 'auth', done: 1, total: 4 },
        todos: { priority: 'P1', open: 3 },
        backlog: { open: 12, max: 40 },
      }),
    ).toEqual(['inverseText', 'suggestion', 'warning', 'warning', 'permission', 'subtle'])

    expect(
      colors({
        ...base,
        cases: { slug: 'auth', done: 4, total: 4 },
        todos: { priority: 'P0', open: 1 },
        backlog: { open: 40, max: 40 },
      }),
    ).toEqual(['inverseText', 'success', 'success', 'error', 'error'])
  })
})

describe('usage', () => {
  test('the context fill and the 5h window read from the measured figures', () => {
    expect(readUsage({ window: 200000, tokens: 84000, percent: 42 }, [
      { kind: 'seven_day', percentUsed: 9 },
      { kind: 'five_hour', percentUsed: 17.5 },
    ])).toEqual({ context: 42, fiveHour: 17.5 })

    // A fresh window has no fill yet, and off a subscription there is no 5h window.
    expect(readUsage({ window: 200000 }, [])).toEqual({ context: null, fiveHour: null })
  })

  test('each figure is a six-cell bar with its percentage', () => {
    expect(usageParts({ context: 42, fiveHour: 17.5 }).map(p => p.text)).toEqual([
      'ctx ███░░░ 42%',
      '5h █░░░░░ 18%',
    ])
    expect(usageParts({ context: 0, fiveHour: 100 }).map(p => p.text)).toEqual([
      'ctx ░░░░░░ 0%',
      '5h ██████ 100%',
    ])
    // Past 100 on an exceeded limit the bar stays full.
    expect(usageParts({ context: null, fiveHour: 104 }).map(p => p.text)).toEqual(['5h ██████ 104%'])
    expect(usageParts({ context: null, fiveHour: null })).toEqual([])
  })

  test('a bar turns warning from 70% and error from 90%', () => {
    expect(usageParts({ context: 69, fiveHour: 70 }).map(p => p.color)).toEqual(['subtle', 'warning'])
    expect(usageParts({ context: 89.9, fiveHour: 90 }).map(p => p.color)).toEqual(['warning', 'error'])
  })
})
