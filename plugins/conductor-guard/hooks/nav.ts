// Pure helpers behind the wiki navigator pane: labels and page bodies from a
// page's text, without touching the engine.
import { countCases, topTodos } from './rules'

// The spec's fixed pages, in reading order; one the wiki lacks is left out.
export const SPEC_PAGES: readonly (readonly [file: string, label: string])[] = [
  ['requirements.md', 'Requirements'],
  ['architecture.md', 'Architecture'],
  ['todos.md', 'Todos'],
  ['gotchas.md', 'Gotchas'],
  ['commands.md', 'Commands'],
  ['git-conventions.md', 'Git conventions'],
]

// The page as it reads, without its frontmatter.
export const pageBody = (text: string): string =>
  text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/^\s+/, '')

export const isEntityPage = (file: string): boolean => file.endsWith('.md') && file !== 'README.md'

export function entityLabel(file: string, text: string): string {
  const slug = file.replace(/\.md$/, '')
  const { done, total } = countCases(text)
  return total === 0 ? `${slug} — no cases` : `${slug} — ${done}/${total} cases`
}

export function todosLabel(text: string): string {
  const top = topTodos(text)
  return top === null ? 'Todos — empty' : `Todos — ${top.open} ${top.priority}`
}

// A decision is named by its first heading, else by its file.
export const pageTitle = (text: string, file: string): string =>
  /^# (.+)$/m.exec(pageBody(text))?.[1]?.trim() ?? file.replace(/\.md$/, '')

// The navigator's pane and the workflow pane the band's menu opens with it.
export const WIKI_PANE = 'wiki-nav'
export const MENU_PANE = 'workflow'

// What a pane's close does. The person's close mark or Esc on a wiki page goes
// back to the index; on the index or the workflow pane it hides both, which the
// band's menu brings back. Any other close goes through.
export function closeAction(id: string, origin: string, page: string | null): 'back' | 'hide' | 'close' {
  if (origin !== 'person') return 'close'
  if (id === WIKI_PANE && page !== null) return 'back'
  return id === WIKI_PANE || id === MENU_PANE ? 'hide' : 'close'
}
