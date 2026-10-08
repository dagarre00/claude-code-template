// What the band shows: read from git and the wiki, null outside a repository.
export type Band = {
  branch: string
  unpushed: number | null
  dirty: number
  cases: { slug: string; done: number; total: number } | null
  todos: { priority: string; open: number } | null
  backlog: { open: number; max: number } | null
}

// What the workflow pane lists, read with the band so drawing runs no git.
export type Menu = {
  branches: { name: string; isCurrent: boolean }[]
  todos: { priority: string; text: string }[]
  changed: string[]
  unpushed: string[]
}

// The session's usage the band draws as bars: whole or one-decimal percentages,
// null until the engine has a reading.
export type Usage = {
  context: number | null
  fiveHour: number | null
}

declare module 'claude-code' {
  interface PluginState {
    // `page`: the page the wiki-page tab shows, a repository path; null before one is opened.
    'conductor-guard': {
      band: Band | null
      page: string | null
      menu: Menu | null
      usage: Usage | null
    }
  }
}
