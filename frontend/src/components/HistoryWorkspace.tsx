import { useEffect, useState } from 'react'
import { getConversations } from '../lib/api'
import type { Conversation } from '../lib/api'

interface HistoryWorkspaceProps {
  loading: boolean
  onSelectConversation: (conversationId: string) => void
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

    loadHistory()

    return () => {
      cancelled = true
    }
  }, [])

  function formatDate(date: string) {
    const parsed = new Date(date)

    if (Number.isNaN(parsed.getTime())) {
      return date
    }

    return parsed.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-5 py-8 md:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-100">
          Conversation History
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Revisit previous research and continue where you left off.
        </p>
      </div>

      {loading && (
        <div className="py-12 text-center text-sm text-gray-500">
          Loading conversations...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className="rounded-2xl border border-[#242630] bg-[#15161c] px-6 py-12 text-center">
          <div className="mb-4 text-3xl text-violet-400">◷</div>

          <h2 className="text-lg font-medium text-gray-200">
            No conversations yet
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Your research conversations will appear here after you start chatting
            with MiniMi.
          </p>
        </div>
      )}

      {!loading && !error && conversations.length > 0 && (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              disabled={appLoading}
              className="group flex w-full items-center justify-between gap-4 rounded-xl border border-[#242630] bg-[#15161c] p-4 text-left transition hover:border-violet-500/40 hover:bg-[#1b1c23] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium text-gray-200 transition group-hover:text-violet-300">
                  {conversation.title?.trim() || 'Untitled conversation'}
                </h2>

                <p className="mt-2 text-xs text-gray-500">
                  Updated {formatDate(conversation.updatedAt)}
                </p>
              </div>

              <span className="shrink-0 text-gray-500 transition group-hover:text-violet-300">
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