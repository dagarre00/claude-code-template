// Pure checks behind the hooks: each reads a tool's input or a file's text and
// answers without touching the engine.
import type { Band } from '../types'

const slashed = (path: string) => path.replaceAll('\\', '/')

// Rule 11: docs/raw/ is append-only.
export const isRawSource = (path: string): boolean => /(^|\/)docs\/raw\//.test(slashed(path))

// Rule 21: the git operations that discard working-tree changes, named as the
// deny message names them. A command line is split on its shell operators, and
// only a segment that runs git counts, so `echo git reset --hard` is not one.
export function destructiveGit(command: string): string | undefined {
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const words = segment.trim().split(/\s+/)
    if (words[0] !== 'git') continue
    const [sub, ...args] = words.slice(words[1] === '-C' ? 3 : 1)
    const has = (...flags: string[]) => args.some(a => flags.includes(a))

    if (sub === 'stash' && !['list', 'show'].includes(args[0] ?? '')) return 'git stash'
    if (sub === 'reset' && has('--hard')) return 'git reset --hard'
    if (sub === 'checkout' && has('--')) return 'git checkout --'
    if (sub === 'checkout' && has('.')) return 'git checkout .'
    if (sub === 'restore' && !(has('--staged', '-S') && !has('--worktree', '-W'))) return 'git restore'
    if (sub === 'clean' && args.some(a => a === '--force' || /^-[a-z]*f/.test(a)) && !has('-n', '--dry-run')) {
      return 'git clean'
    }
  }
  return undefined
}

// Rule 10: these carry the conductor's context into the dispatch; an Agent
// call with no type runs general-purpose.
export const isForbiddenDispatch = (type: string | undefined): boolean =>
  type === undefined || type === 'fork' || type === 'general-purpose'

// Rule 19: a commit that changes the repository.
export const isCommit = (command: string): boolean =>
  /\bgit\s+commit\b/.test(command) && !/--dry-run\b/.test(command)

// The entity a code branch builds (git-conventions: the slug equals it).
export const entitySlug = (branch: string): string | undefined =>
  /^(?:feat|fix|refactor|perf)\/(.+)$/.exec(branch)?.[1]

// spec-writing: `- [ ] B<N>: ...`, `[~]` red, `[x]` done.
export function countCases(page: string): { done: number; total: number } {
  const marks = [...page.matchAll(/^- \[([ ~x])\] B\d+:/gm)].map(m => m[1])
  return { done: marks.filter(m => m === 'x').length, total: marks.length }
}

// todos.md § Filed-findings backlog: the open [adversary] lines and the cap.
export function countBacklog(todos: string): { open: number; max: number } {
  const open = todos.match(/^- \[ \] .*\[adversary\]/gm)?.length ?? 0
  const max = Number(/FINDINGS_MAX = (\d+)/.exec(todos)?.[1] ?? 40)
  return { open, max }
}

// todos.md: each queue section names its priority in its heading, `## Now
// (P0 — next)`; the band counts the open items of the first that has any.
export function topTodos(todos: string): { priority: string; open: number } | null {
  for (const section of todos.split(/^(?=## )/m)) {
    const priority = /^## [^\n(]*\((P\d)\b/.exec(section)?.[1]
    if (priority === undefined) continue
    const open = section.match(/^- \[ \] /gm)?.length ?? 0
    if (open > 0) return { priority, open }
  }
  return null
}

export function bandText(band: Band): string {
  const parts = [band.branch]
  if (band.cases) parts.push(`${band.cases.slug} ${band.cases.done}/${band.cases.total} cases`)
  if (band.unpushed === null) parts.push('no upstream')
  else if (band.unpushed > 0) parts.push(`${band.unpushed} unpushed`)
  parts.push(band.dirty > 0 ? `${band.dirty} changed` : 'clean')
  if (band.todos) parts.push(`${band.todos.open} ${band.todos.priority} todos`)
  if (band.backlog) parts.push(`backlog ${band.backlog.open}/${band.backlog.max}`)
  return parts.join(' · ')
}
