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
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? 'border-violet-500/50 bg-violet-500/10'
          : 'border-[#282a35] bg-[#15161c] hover:border-[#414251]'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#24232f] px-2.5 py-1 text-xs text-violet-300">
          {result.kind ? kindLabel(result.kind) : 'Conversation'}
        </span>

        <span className="rounded-full bg-[#22232a] px-2.5 py-1 text-xs text-gray-400">
          {sourceLabel(result.sourceType)}
        </span>
      </div>

      <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-gray-300">
        {result.content}
      </p>

      <div className="mt-3 text-xs text-gray-500">
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
    <div className="rounded-2xl border border-[#282a35] bg-[#15161c] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-200">
          Record details
        </h3>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
          {kindLabel(result.kind)}
        </span>

        <span className="rounded-full bg-[#242630] px-3 py-1 text-xs text-gray-400">
          {sourceLabel(result.sourceType)}
        </span>
      </div>

      <div className="mb-5 whitespace-pre-wrap break-words text-sm leading-7 text-gray-300">
        {result.content}
      </div>

      <div className="space-y-3 border-t border-[#282a35] pt-4">
        <div>
          <span className="mb-1 block text-xs text-gray-500">
            Source ID
          </span>
          <code className="block break-all text-xs text-gray-400">
            {result.sourceId}
          </code>
        </div>

        <div>
          <span className="mb-1 block text-xs text-gray-500">
            Created
          </span>
          <span className="text-sm text-gray-400">
            {formatDate(result.createdAt)}
          </span>
        </div>

        <div>
          <span className="mb-1 block text-xs text-gray-500">
            Search relevance score
          </span>
          <code className="text-xs text-gray-400">
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
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-y-auto px-5 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">
          Memory
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Search stored memory records and indexed conversation
          content. Inspect what MiniMi can retrieve and trace
          results back to their source identifiers.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="mb-6 flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search memory and conversations..."
          maxLength={500}
          className="min-w-0 flex-1 rounded-xl border border-[#30313c] bg-[#15161c] px-4 py-3 text-sm text-gray-200 outline-none transition focus:border-violet-500"
        />

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search memory'}
        </button>
      </form>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={kindFilter}
          onChange={(event) =>
            setKindFilter(event.target.value as MemoryKind | 'all')
          }
          className="rounded-lg border border-[#30313c] bg-[#15161c] px-3 py-2 text-sm text-gray-300 outline-none"
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
          className="rounded-lg border border-[#30313c] bg-[#15161c] px-3 py-2 text-sm text-gray-300 outline-none"
        >
          <option value="all">All sources</option>
          <option value="memory_record">Memory records</option>
          <option value="conversation_message">
            Conversation messages
          </option>
        </select>

        {searched && (
          <span className="ml-auto text-xs text-gray-500">
            {filteredResults.length} result
            {filteredResults.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!searched ? (
        <div className="rounded-2xl border border-dashed border-[#30313c] p-10 text-center">
          <div className="mb-3 text-3xl">⌘</div>
          <h2 className="font-medium text-gray-300">
            Search your memory
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Enter a keyword, topic or phrase to explore indexed
            memory and conversation content.
          </p>
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-[#282a35] bg-[#15161c] p-10 text-center text-sm text-gray-500">
          Searching indexed memory...
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#30313c] p-10 text-center">
          <h2 className="font-medium text-gray-300">
            No matching results
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Try another search term or remove the active filters.
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <div className="space-y-3">
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
              <div className="sticky top-0 rounded-2xl border border-dashed border-[#30313c] p-8 text-center text-sm text-gray-500">
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