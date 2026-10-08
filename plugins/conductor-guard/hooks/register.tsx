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
import { SPEC_PAGES, entityLabel, isEntityPage, pageBody, pageTitle, todosLabel } from './nav'

const band = atom({ plugin: 'conductor-guard', key: 'band' } as const, null)
const page = atom({ plugin: 'conductor-guard', key: 'page' } as const, null)
const PANE = 'wiki-nav'
const WIKI = 'docs/wiki'

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
type NavGroup = { heading: string; items: { path: string; label: string }[] }

// The navigator's list, read fresh at each draw: the spec's fixed pages, then
// every entity and decision. A page or folder the wiki lacks is left out.
async function wikiIndex($: EngineInterface): Promise<NavGroup[]> {
  const spec: NavGroup = { heading: 'Spec', items: [] }
  for (const [file, label] of SPEC_PAGES) {
    const body = await text($, `${WIKI}/${file}`)
    if (body !== undefined) {
      spec.items.push({ path: `${WIKI}/${file}`, label: file === 'todos.md' ? todosLabel(body) : label })
    }
  }

  const folder = async (dir: string, label: (file: string, body: string) => string) => {
    const entries = await $.fs.list(`${WIKI}/${dir}`).catch(() => [])
    const items = []
    for (const entry of entries.filter(e => e.kind === 'file' && isEntityPage(e.name))) {
      const path = `${WIKI}/${dir}/${entry.name}`
      items.push({ path, label: label(entry.name, (await text($, path)) ?? '') })
    }
    return items.sort((a, b) => a.path.localeCompare(b.path))
  }

  const groups = [
    spec,
    { heading: 'Entities', items: await folder('entities', entityLabel) },
    { heading: 'Decisions', items: await folder('decisions', (file, body) => pageTitle(body, file)) },
  ]
  return groups.filter(group => group.items.length > 0)
}

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
    // A refused registration costs the navigator's command, never the band.
    try {
      await $.command.register({ name: 'wiki-nav', description: 'Browse the wiki spec in a pane' })
    } catch {}
    const started = await next(e)
    void refresh($)
    return started
  })

  on('command.run', { command: 'wiki-nav' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Wiki', focus: true })
    return { text: 'Wiki navigator opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const open = await read($, page)

    if (open !== null) {
      const body = await text($, open)
      return (
        <Box flexDirection="column">
          <Button key="back" label="← Back" hotkey="b" onPress={() => update($, page, () => null)} />
          {body === undefined ? (
            <Text dimColor>{open} is gone.</Text>
          ) : (
            <Markdown text={pageBody(body).slice(0, 100000)} />
          )}
        </Box>
      )
    }

    const groups = await wikiIndex($)
    return (
      <Box flexDirection="column">
        {groups.length === 0 && <Text dimColor>No docs/wiki/ here.</Text>}
        {groups.map(group => (
          <Box key={group.heading} flexDirection="column">
            <Text bold>{group.heading}</Text>
            {group.items.map(item => (
              <Button key={item.path} label={item.label} plain onPress={() => update($, page, () => item.path)} />
            ))}
          </Box>
        ))}
      </Box>
    )
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
