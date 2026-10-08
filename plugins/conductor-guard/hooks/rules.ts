// Pure checks behind the hooks: each reads a tool's input or a file's text and
// answers without touching the engine.
import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { Band, Usage } from '../types'

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

    // The workflow's own forms pass, each run after its skill accounts for the
    // tree: the tagged stash and `stash apply <sha>` (feature-branching), and a
    // restore from a named commit (subagent-dispatch's Red check).
    const isTaggedStash = has('-m', '--message') || ['list', 'show', 'apply'].includes(args[0] ?? '')
    const isStagedOnly = has('--staged', '-S') && !has('--worktree', '-W')
    const hasSource = args.some(a => a === '-s' || a.startsWith('--source'))

    if (sub === 'stash' && !isTaggedStash) return 'git stash'
    if (sub === 'reset' && has('--hard')) return 'git reset --hard'
    if (sub === 'checkout' && has('--')) return 'git checkout --'
    if (sub === 'checkout' && has('.')) return 'git checkout .'
    if (sub === 'restore' && !isStagedOnly && !hasSource) return 'git restore'
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

// todos.md: every open item of the priority sections, in queue order.
export function openTodos(todos: string): { priority: string; text: string }[] {
  const items = []
  for (const section of todos.split(/^(?=## )/m)) {
    const priority = /^## [^\n(]*\((P\d)\b/.exec(section)?.[1]
    if (priority === undefined) continue
    for (const m of section.matchAll(/^- \[ \] (.+?)\r?$/gm)) items.push({ priority, text: m[1]! })
  }
  return items
}

// One part of the band: its text, a theme color (so it follows light and dark
// themes) and a key the drawing gives its element. The branch comes first and
// is drawn on a chip; the rest color by whether they need attention.
export type BandPart = { key: string; text: string; color: string }

export function bandParts(band: Band): BandPart[] {
  const parts: BandPart[] = [{ key: 'branch', text: band.branch, color: 'inverseText' }]
  if (band.cases) {
    const { slug, done, total } = band.cases
    parts.push({ key: 'cases', text: `${slug} ${done}/${total} cases`, color: done === total && total > 0 ? 'success' : 'suggestion' })
  }
  if (band.unpushed === null) parts.push({ key: 'unpushed', text: 'no upstream', color: 'warning' })
  else if (band.unpushed > 0) parts.push({ key: 'unpushed', text: `${band.unpushed} unpushed`, color: 'warning' })
  parts.push(
    band.dirty > 0
      ? { key: 'changed', text: `${band.dirty} changed`, color: 'warning' }
      : { key: 'changed', text: 'clean', color: 'success' },
  )
  if (band.todos) {
    const { priority, open } = band.todos
    parts.push({ key: 'todos', text: `${open} ${priority} todos`, color: priority === 'P0' ? 'error' : 'permission' })
  }
  if (band.backlog) {
    const { open, max } = band.backlog
    parts.push({ key: 'backlog', text: `backlog ${open}/${max}`, color: open >= max ? 'error' : 'subtle' })
  }
  return parts
}

export const bandText = (band: Band): string => bandParts(band).map(p => p.text).join(' · ')

// The session's figures the band draws: the context window's fill and the
// five-hour rate-limit window, each null until the engine has a reading.
export const readUsage = (context: SessionContextUsage, rateLimits: SessionRateLimit[]): Usage => ({
  context: context.percent ?? null,
  fiveHour: rateLimits.find(limit => limit.kind === 'five_hour')?.percentUsed ?? null,
})

const CELLS = 6

function meter(label: string, key: string, percent: number): BandPart {
  const full = Math.min(CELLS, Math.round((percent / 100) * CELLS))
  const bar = '█'.repeat(full) + '░'.repeat(CELLS - full)
  const color = percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'subtle'
  return { key, text: `${label} ${bar} ${Math.round(percent)}%`, color }
}

export function usageParts(usage: Usage): BandPart[] {
  const parts: BandPart[] = []
  if (usage.context !== null) parts.push(meter('ctx', 'context', usage.context))
  if (usage.fiveHour !== null) parts.push(meter('5h', 'five-hour', usage.fiveHour))
  return parts
}
