import { useEffect, useState } from 'react'
import { getConversations } from '../lib/api'
import type { Conversation } from '../lib/api'

interface HistoryWorkspaceProps {
  loading: boolean
  onSelectConversation: (conversationId: string) => void
}

function formatDate(date: string) {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) return date

  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function HistoryWorkspace({
  loading: appLoading,
  onSelectConversation,
}: HistoryWorkspaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      setLoading(true)
      setError(null)

      try {
        const response = await getConversations()

        if (!cancelled) {
          setConversations(response.conversations)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load conversation history.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-7 border-b border-[var(--border-subtle)] pb-5">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
          Workspace
        </p>

        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          History
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
          Reopen earlier research and continue from where you left off.
        </p>
      </header>

      {loading && (
        <div className="border border-[var(--border-subtle)] px-4 py-8 text-sm text-[var(--text-secondary)]">
          Loading conversations…
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="border border-[var(--status-red)]/40 bg-[var(--surface-raised)] p-4 text-sm text-[var(--status-red)]"
        >
          {error}
        </div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className="border border-dashed border-[var(--border-strong)] px-5 py-12 text-center">
          <div className="mb-3 text-xl text-[var(--accent)]">◷</div>

          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            No conversations yet
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
            Research conversations will appear here once you start using MiniMi.
          </p>
        </div>
      )}

      {!loading && !error && conversations.length > 0 && (
        <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              disabled={appLoading}
              className="group flex w-full min-w-0 items-center gap-4 px-3 py-4 text-left transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[var(--border-strong)] text-sm text-[var(--accent)]">
                ◷
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                  {conversation.title?.trim() || 'Untitled conversation'}
                </span>

                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  Updated {formatDate(conversation.updatedAt)}
                </span>
              </span>

              <span
                className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent)]"
                aria-hidden="true"
              >
                →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default HistoryWorkspace