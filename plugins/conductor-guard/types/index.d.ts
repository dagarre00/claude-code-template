// What the band shows: read from git and the wiki, null outside a repository.
export type Band = {
  branch: string
  unpushed: number | null
  dirty: number
  cases: { slug: string; done: number; total: number } | null
  todos: { priority: string; open: number } | null
  backlog: { open: number; max: number } | null
}

declare module 'claude-code' {
  interface PluginState {
    // `page`: the wiki navigator's open page, a repository path; null shows the list.
    'conductor-guard': { band: Band | null; page: string | null }
  }
}
