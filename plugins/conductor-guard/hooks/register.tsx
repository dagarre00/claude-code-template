import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Band, Menu } from '../types'
import {
  bandParts,
  countBacklog,
  countCases,
  destructiveGit,
  entitySlug,
  isCommit,
  isForbiddenDispatch,
  isRawSource,
  openTodos,
  readUsage,
  topTodos,
  usageParts,
} from './rules'
import { SPEC_PAGES, entityLabel, isEntityPage, pageBody, pageTitle, todosLabel } from './nav'

const band = atom({ plugin: 'conductor-guard', key: 'band' } as const, null)
const page = atom({ plugin: 'conductor-guard', key: 'page' } as const, null)
const menu = atom({ plugin: 'conductor-guard', key: 'menu' } as const, null)
const usage = atom({ plugin: 'conductor-guard', key: 'usage' } as const, null)
const PANE = 'wiki-nav'
const MENU = 'workflow'
const WIKI = 'docs/wiki'
const TODOS = `${WIKI}/todos.md`

const git = async ($: EngineInterface, ...args: string[]) => {
  const { exitCode, stdout } = await $.process.run(['git', ...args])
  return exitCode === 0 ? stdout.trimEnd() : undefined
}

const text = ($: EngineInterface, path: string) => $.fs.read(path).then(t => String(t), () => undefined)

// Installed for every repository, the plugin acts only where the workflow
// lives: its rules file marks a project built from the template.
const isWorkflowProject = ($: EngineInterface) =>
  $.fs.exists('.claude/rules/behavioral.md').catch(() => false)

async function readBand($: EngineInterface): Promise<Band | null> {
  if (!(await isWorkflowProject($))) return null
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

// Runs unawaited after the hook returns, so it never rejects: a band that
// cannot be read, or a module unloaded meanwhile, leaves the band as it was.
const refresh = async ($: EngineInterface) => {
  try {
    const next = await readBand($).catch(() => null)
    await update($, band, () => next)
    const listed = next === null ? null : await readMenu($).catch(() => null)
    await update($, menu, () => listed)
  } catch {}
}

const lines = (out: string | undefined) => (out ?? '').split('\n').filter(line => line.trim() !== '')

async function readMenu($: EngineInterface): Promise<Menu> {
  return {
    branches: lines(await git($, 'branch', '--format=%(HEAD) %(refname:short)')).map(line => ({
      name: line.slice(2),
      isCurrent: line.startsWith('*'),
    })),
    todos: openTodos((await text($, TODOS)) ?? ''),
    changed: lines(await git($, 'status', '--porcelain')),
    unpushed: lines(await git($, 'log', '--oneline', '@{u}..HEAD')),
  }
}

// A branch picked in the workflow pane. Switching carries uncommitted changes
// along, so it is refused over a dirty tree (rule 21), as the guard refuses
// destructive git; the git command's own error is shown as it came.
async function switchBranch($: EngineInterface, name: string) {
  const porcelain = (await git($, 'status', '--porcelain')) ?? ''
  if (porcelain !== '') {
    $.ui.toast(`conductor-guard: commit or account for the changed files before switching to ${name} (rule 21).`)
    return
  }
  const { exitCode, stderr } = await $.process.run(['git', 'switch', name])
  $.ui.toast(exitCode === 0 ? `Switched to ${name}.` : `git switch ${name} failed: ${stderr.trim()}`)
  await refresh($)
}

// Rule 19 applies once /project:init has filled CLAUDE.md: the template
// itself keeps no log entries.
async function missesLogEntry($: EngineInterface): Promise<boolean> {
  if (!(await isWorkflowProject($))) return false
  const claudeMd = await text($, 'CLAUDE.md')
  if (claudeMd === undefined || claudeMd.includes('<set during project initialization>')) return false
  if (!(await $.fs.exists('docs/wiki/log.md'))) return false
  const changed = (await git($, 'show', '--name-only', '--format=', 'HEAD')) ?? ''
  return !changed.split('\n').includes('docs/wiki/log.md')
}

export const register: Register = on => {
  on('tool.call', { tool: 'Edit' }, async ($, e, next) =>
    isRawSource(e.file_path) && (await isWorkflowProject($))
      ? { deny: `conductor-guard: ${e.file_path} is a raw source; add a new file instead (rule 11).` }
      : next(e),
  ).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'conductor-guard: its raw-source check failed (rule 11).' },
  )

  on('tool.call', { tool: 'Write' }, async ($, e, next) =>
    isRawSource(e.file_path) && (await $.fs.exists(e.file_path)) && (await isWorkflowProject($))
      ? { deny: `conductor-guard: ${e.file_path} is a raw source; add a new file instead (rule 11).` }
      : next(e),
  ).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'conductor-guard: its raw-source check failed (rule 11).' },
  )

  on('tool.call', { tool: 'Agent' }, async ($, e, next) =>
    isForbiddenDispatch(e.subagent_type) && (await isWorkflowProject($))
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
    if (operation !== undefined && (await isWorkflowProject($))) {
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
      if (await isWorkflowProject($)) {
        await $.command.register({ name: 'wiki-nav', description: 'Browse the wiki spec in a pane' })
      }
    } catch {}
    const started = await next(e)
    void refresh($)
    // The figures so far; each later move arrives as session.measure.
    void $.session
      .usage()
      .then(now => update($, usage, () => readUsage(now.context, now.rateLimits)))
      .catch(() => {})
    return started
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => readUsage(e.context, e.rateLimits)).catch(() => {})
    return next(e)
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

  // The workflow pane the band's menu opens: branches to switch to, the open
  // todos, and what is changed or unpushed. It draws what the last refresh
  // read and runs no git itself: a redraw aborts a draw still waiting on one.
  on('ui.render', { component: 'Pane', requestId: MENU }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const shown = await read($, menu)
    if (shown === null) return <Text dimColor>Reading the repository…</Text>
    const { branches, todos, changed, unpushed } = shown

    const openTodosPage = async () => {
      await update($, page, () => TODOS)
      await $.ui.open({ id: PANE, title: 'Wiki', focus: true })
    }

    return (
      <Box flexDirection="column">
        <Text bold>Branches</Text>
        {branches.map(b => (
          <Button
            key={`branch:${b.name}`}
            label={`${b.isCurrent ? '●' : ' '} ${b.name}`}
            plain
            onPress={() => (b.isCurrent ? undefined : void switchBranch($, b.name))}
          />
        ))}
        <Text bold>Todos</Text>
        {todos.length === 0 && <Text dimColor>No open todos.</Text>}
        {todos.map((todo, i) => (
          <Button key={`todo:${i}`} label={`${todo.priority}  ${todo.text}`} plain onPress={() => void openTodosPage()} />
        ))}
        <Text bold>Status</Text>
        {changed.length === 0 && unpushed.length === 0 && <Text dimColor>Clean and pushed.</Text>}
        {changed.map(line => (
          <Text key={`changed:${line}`} color="warning">{line}</Text>
        ))}
        {unpushed.map(line => (
          <Text key={`unpushed:${line}`} dimColor>{line}</Text>
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

    const { Box, Text, Button } = $.ui.resolve(e)
    const measured = await read($, usage)
    const [branch, ...rest] = [...bandParts(shown), ...(measured === null ? [] : usageParts(measured))]
    return (
      <Box flexDirection="row" gap={1}>
        <Text bold color={branch!.color} backgroundColor="claude">{` ${branch!.text} `}</Text>
        {rest.map((part, i) => (
          <Text key={part.key} color={part.color}>{i === 0 ? part.text : `· ${part.text}`}</Text>
        ))}
        <Button
          key="menu"
          label="≡"
          plain
          onPress={() => {
            void $.ui.open({ id: MENU, title: 'Workflow', focus: true })
            void refresh($)
          }}
        />
      </Box>
    )
  })
}
