import { useState } from 'react'
import type { FormEvent } from 'react'
import { executeAgent, getConversation } from './lib/api'
import Sidebar from './components/Sidebar'
import WelcomeScreen from './components/WelcomeScreen'
import ErrorBanner from './components/ErrorBanner'
import ChatInput from './components/ChatInput'
import MessageList from './components/MessageList'
import HistoryWorkspace from './components/HistoryWorkspace'
import VerificationWorkspace from './components/VerificationWorkspace'
import MemoryWorkspace from './components/MemoryWorkspace'
import type { ChatMessage as ChatMessageType } from './components/types'

type Workspace = 'research' | 'history' | 'memory' | 'verification'

function App() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeWorkspace, setActiveWorkspace] =
    useState<Workspace>('research')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedMessage = message.trim()

    if (!trimmedMessage || loading) return

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedMessage,
    }

    setMessages((previous) => [...previous, userMessage])
    setMessage('')
    setError(null)
    setLoading(true)

    try {
      const response = await executeAgent({
        message: trimmedMessage,
        ...(conversationId ? { conversationId } : {}),
      })

      setConversationId(response.conversationId)

      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.answer,
          response,
        },
      ])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while contacting MiniMi.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function selectConversation(id: string) {
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      const response = await getConversation(id)

      const restoredMessages: ChatMessageType[] = response.messages
        .filter(
          (storedMessage) =>
            storedMessage.role === 'user' ||
            storedMessage.role === 'assistant',
        )
        .map((storedMessage) => ({
          id: storedMessage.id,
          role: storedMessage.role as 'user' | 'assistant',
          content: storedMessage.content,
        }))

      setMessages(restoredMessages)
      setConversationId(response.conversation.id)
      setMessage('')
      setActiveWorkspace('research')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reopen this conversation.',
      )
    } finally {
      setLoading(false)
    }
  }

  function startNewChat() {
    if (loading) return

    setMessages([])
    setConversationId(undefined)
    setError(null)
    setMessage('')
    setActiveWorkspace('research')
  }

  function changeWorkspace(workspace: Workspace) {
    if (loading) return

    setActiveWorkspace(workspace)
    setError(null)
  }

  const workspaceName: Record<Workspace, string> = {
    research: 'Research',
    history: 'History',
    memory: 'Memory',
    verification: 'Verification',
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] overflow-hidden bg-[var(--surface-base)] text-[var(--text-primary)]">
      <Sidebar
        loading={loading}
        onNewChat={startNewChat}
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={changeWorkspace}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden pb-14 md:pb-0">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden text-[var(--text-muted)] sm:inline">
              MiniMi
            </span>

            <span className="hidden text-[var(--border-strong)] sm:inline">
              /
            </span>

            <span className="truncate font-medium text-[var(--text-primary)]">
              {workspaceName[activeWorkspace]}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-green)]" />
            <span>Local environment</span>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeWorkspace === 'research' ? (
            <>
              {messages.length === 0 ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <WelcomeScreen />
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
                    <MessageList messages={messages} loading={loading} />
                  </div>
                </div>
              )}

              {error && (
                <div className="shrink-0">
                  <ErrorBanner
                    error={error}
                    onDismiss={() => setError(null)}
                  />
                </div>
              )}

              <div className="shrink-0">
                <ChatInput
                  message={message}
                  onMessageChange={setMessage}
                  loading={loading}
                  onSubmit={handleSubmit}
                />
              </div>
            </>
          ) : activeWorkspace === 'history' ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <HistoryWorkspace
                  loading={loading}
                  onSelectConversation={selectConversation}
                />
              </div>

              {error && (
                <div className="shrink-0">
                  <ErrorBanner
                    error={error}
                    onDismiss={() => setError(null)}
                  />
                </div>
              )}
            </>
          ) : activeWorkspace === 'memory' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MemoryWorkspace />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <VerificationWorkspace />
            </div>
          )}
        </section>

        <footer className="flex shrink-0 items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2.5 text-[10px] text-[var(--text-muted)] sm:px-6">
          <span>MiniMi Agent</span>

          <span className="hidden sm:inline">
            Research · Memory · Verification
          </span>
        </footer>
      </main>
    </div>
  )
}

export default App