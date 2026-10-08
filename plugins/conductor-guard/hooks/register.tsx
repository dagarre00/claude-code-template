import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Band } from '../types'
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

const band = atom({ plugin: 'conductor-guard', key: 'band' } as const, null)

const git = async ($: EngineInterface, ...args: string[]) => {
  const { exitCode, stdout } = await $.process.run(['git', ...args])
  return exitCode === 0 ? stdout.trimEnd() : undefined
}

const text = ($: EngineInterface, path: string) => $.fs.read(path).then(t => String(t), () => undefined)

async function readBand($: EngineInterface): Promise<Band | null> {
  const branch = await git($, 'rev-parse', '--abbrev-ref', 'HEAD')
  if (branch === undefined) return null

  const unpushed = await git($, 'rev-list', '--count', '@{u}..HEAD')
  const porcelain = (await git($, 'status', '--porcelain')) ?? ''
  const slug = entitySlug(branch)
  const page = slug === undefined ? undefined : await text($, `docs/wiki/entities/${slug}.md`)
  const todos = await text($, 'docs/wiki/todos.md')

  return {
    branch,
    unpushed: unpushed === undefined ? null : Number(unpushed),
    dirty: porcelain === '' ? 0 : porcelain.split('\n').length,
    cases: slug !== undefined && page !== undefined ? { slug, ...countCases(page) } : null,
    todos: todos === undefined ? null : topTodos(todos),
    backlog: todos === undefined ? null : countBacklog(todos),
  }
}

// Runs unawaited after the hook returns, so it never rejects: a band that
// cannot be read, or a module unloaded meanwhile, leaves the band as it was.
const refresh = async ($: EngineInterface) => {
  try {
    const next = await readBand($).catch(() => null)
    await update($, band, () => next)
  } catch {}
}

// Rule 19 applies once /project:init has filled CLAUDE.md: the template
// itself keeps no log entries.
async function missesLogEntry($: EngineInterface): Promise<boolean> {
  const claudeMd = await text($, 'CLAUDE.md')
  if (claudeMd === undefined || claudeMd.includes('<set during project initialization>')) return false
  if (!(await $.fs.exists('docs/wiki/log.md'))) return false
  const changed = (await git($, 'show', '--name-only', '--format=', 'HEAD')) ?? ''
  return !changed.split('\n').includes('docs/wiki/log.md')
}

export const register: Register = on => {
  on('tool.call', { tool: 'Edit' }, ($, e, next) =>
    isRawSource(e.file_path)
      ? { deny: `conductor-guard: ${e.file_path} is a raw source; add a new file instead (rule 11).` }
      : next(e),
  ).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'conductor-guard: its raw-source check failed (rule 11).' },
  )

  on('tool.call', { tool: 'Write' }, async ($, e, next) =>
    isRawSource(e.file_path) && (await $.fs.exists(e.file_path))
      ? { deny: `conductor-guard: ${e.file_path} is a raw source; add a new file instead (rule 11).` }
      : next(e),
  ).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'conductor-guard: its raw-source check failed (rule 11).' },
  )

  on('tool.call', { tool: 'Agent' }, ($, e, next) =>
    isForbiddenDispatch(e.subagent_type)
      ? {
          deny:
            `conductor-guard: subagent_type ${e.subagent_type ?? '(none: general-purpose)'} carries the ` +
            'conductor context. Dispatch the role by its own subagent_type, or Explore for a search (rule 10).',
        }
      : next(e),
  ).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'conductor-guard: its dispatch check failed (rule 10).' },
  )

  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    const operation = destructiveGit(e.command)
    if (operation !== undefined) {
      const porcelain = (await git($, 'status', '--porcelain')) ?? ''
      if (porcelain !== '') {
        return {
          deny:
            `conductor-guard: ${operation} would discard changes this session may not own (rule 21). ` +
            `Account for every path first, or ask the human:\n${porcelain}`,
        }
      }
    }

    const ran = await next(e)

    if (/\bgit\b/.test(e.command)) {
      if (isCommit(e.command) && ran.deny === undefined && ran.isError !== true && (await missesLogEntry($))) {
        $.ui.toast('conductor-guard: that commit has no docs/wiki/log.md entry (rule 19).')
      }
      void refresh($)
    }
    return ran
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'conductor-guard: its git check failed (rule 21).' },
  )

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    void refresh($)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    void refresh($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, band)
    if (shown === null || e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text dimColor>{bandText(shown)}</Text>
      </Box>
    )
  })
}
