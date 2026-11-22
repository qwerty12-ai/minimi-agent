import { useState } from 'react'
import type { FormEvent } from 'react'
import { searchMemory } from '../lib/api'
import type {
  MemoryKind,
  MemorySearchResult,
  MemorySearchSourceType,
} from '../lib/api'

const kinds: MemoryKind[] = [
  'fact',
  'preference',
  'decision',
  'context',
]

type SourceFilter = 'all' | MemorySearchSourceType

function formatDate(date: string) {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleString()
}

function kindLabel(kind?: MemoryKind) {
  if (!kind) return 'Conversation'

  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

function sourceLabel(source: MemorySearchSourceType) {
  return source === 'memory_record'
    ? 'Memory record'
    : 'Conversation message'
}

function ResultCard({
  result,
  selected,
  onClick,
}: {
  result: MemorySearchResult
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full border p-4 text-left transition-colors ${
        selected
          ? 'border-[var(--accent-muted)] bg-[var(--accent-soft)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-strong)]'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--accent)]">
          {result.kind ? kindLabel(result.kind) : 'Conversation'}
        </span>

        <span className="border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
          {sourceLabel(result.sourceType)}
        </span>
      </div>

      <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">
        {result.content}
      </p>

      <div className="mt-3 text-xs text-[var(--text-muted)]">
        {formatDate(result.createdAt)}
      </div>
    </button>
  )
}

function DetailPanel({
  result,
}: {
  result: MemorySearchResult
}) {
  return (
    <div className="border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Record details
        </h3>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--accent)]">
          {kindLabel(result.kind)}
        </span>

        <span className="border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
          {sourceLabel(result.sourceType)}
        </span>
      </div>

      <div className="mb-5 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-secondary)]">
        {result.content}
      </div>

      <div className="space-y-0 divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] pt-4">
        <div className="py-3">
          <span className="mb-1 block text-xs text-[var(--text-muted)]">
            Source ID
          </span>

          <code className="block break-all text-xs text-[var(--text-secondary)]">
            {result.sourceId}
          </code>
        </div>

        <div className="py-3">
          <span className="mb-1 block text-xs text-[var(--text-muted)]">
            Created
          </span>

          <span className="text-sm text-[var(--text-secondary)]">
            {formatDate(result.createdAt)}
          </span>
        </div>

        <div className="py-3">
          <span className="mb-1 block text-xs text-[var(--text-muted)]">
            Search relevance score
          </span>

          <code className="text-xs text-[var(--text-secondary)]">
            {result.rank.toFixed(5)}
          </code>
        </div>
      </div>
    </div>
  )
}

function MemoryWorkspace() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemorySearchResult[]>([])
  const [selected, setSelected] = useState<MemorySearchResult | null>(null)
  const [kindFilter, setKindFilter] = useState<MemoryKind | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = query.trim()

    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    setSelected(null)
    setSearched(true)

    try {
      const response = await searchMemory(trimmed, 30)
      setResults(response.results)
    } catch (err) {
      setResults([])

      setError(
        err instanceof Error
          ? err.message
          : 'Memory search failed.',
      )
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = results.filter((result) => {
    const matchesKind =
      kindFilter === 'all' ||
      result.kind === kindFilter

    const matchesSource =
      sourceFilter === 'all' ||
      result.sourceType === sourceFilter

    return matchesKind && matchesSource
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Memory
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Search stored memory records and indexed conversation
          content. Inspect what MiniMi can retrieve and trace
          results back to their source identifiers.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="mb-5 flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search memory and conversations..."
          maxLength={500}
          className="min-w-0 flex-1 border border-[var(--border-strong)] bg-[var(--surface-input)] px-3 py-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-muted)]"
        />

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search memory'}
        </button>
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select
          value={kindFilter}
          onChange={(event) =>
            setKindFilter(event.target.value as MemoryKind | 'all')
          }
          className="border border-[var(--border-strong)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--accent-muted)]"
        >
          <option value="all">All categories</option>

          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {kindLabel(kind)}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(event) =>
            setSourceFilter(event.target.value as SourceFilter)
          }
          className="border border-[var(--border-strong)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--accent-muted)]"
        >
          <option value="all">All sources</option>
          <option value="memory_record">Memory records</option>
          <option value="conversation_message">
            Conversation messages
          </option>
        </select>

        {searched && (
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            {filteredResults.length} result
            {filteredResults.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-5 border border-[var(--status-red)]/40 bg-[var(--surface-raised)] p-4 text-sm text-[var(--status-red)]">
          {error}
        </div>
      )}

      {!searched ? (
        <div className="border border-dashed border-[var(--border-strong)] p-10 text-center">
          <div className="mb-3 text-xl text-[var(--accent)]">⌘</div>

          <h2 className="font-medium text-[var(--text-primary)]">
            Search your memory
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Enter a keyword, topic or phrase to explore indexed
            memory and conversation content.
          </p>
        </div>
      ) : loading ? (
        <div className="border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10 text-center text-sm text-[var(--text-secondary)]">
          Searching indexed memory...
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="border border-dashed border-[var(--border-strong)] p-10 text-center">
          <h2 className="font-medium text-[var(--text-primary)]">
            No matching results
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Try another search term or remove the active filters.
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="space-y-0 divide-y divide-[var(--border-subtle)]">
            {filteredResults.map((result, index) => (
              <ResultCard
                key={`${result.sourceType}-${result.sourceId}-${index}`}
                result={result}
                selected={selected === result}
                onClick={() => setSelected(result)}
              />
            ))}
          </div>

          <div className="min-w-0">
            {selected ? (
              <DetailPanel result={selected} />
            ) : (
              <div className="sticky top-4 border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--text-muted)]">
                Select a search result to inspect its metadata.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MemoryWorkspace