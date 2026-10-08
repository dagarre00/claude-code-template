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

// Rows a page's text takes at a width: each line wrapped, plus a margin for
// the spacing Markdown adds, so the last window never cuts the page short.
export const pageRows = (text: string, columns: number): number =>
  text.split('\n').reduce((rows, line) => rows + Math.max(1, Math.ceil(line.length / Math.max(1, columns))), 0) + 2

// Where a window of `windowRows` over `rows` starts after moving `by`.
export const scrolledTo = (offset: number, by: number, rows: number, windowRows: number): number =>
  Math.max(0, Math.min(offset + by, rows - windowRows))
