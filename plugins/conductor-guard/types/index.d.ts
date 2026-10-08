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
    'conductor-guard': { band: Band | null }
  }
}
