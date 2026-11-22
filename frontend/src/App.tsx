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
    <div className="flex min-h-screen bg-[#0c0d10] text-[#e5e7eb]">
      <Sidebar
        loading={loading}
        onNewChat={startNewChat}
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={changeWorkspace}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#242630] px-5 md:px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Workspace</span>
            <span className="text-gray-700">/</span>
            <strong className="text-gray-200">
              {workspaceName[activeWorkspace]}
            </strong>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-[#254333] bg-[#14251c] px-3 py-1.5 text-[10px] font-semibold tracking-wider text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            LOCAL
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col">
          {activeWorkspace === 'research' ? (
            <>
              {messages.length === 0 ? (
                <WelcomeScreen />
              ) : (
                <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-5 py-8 md:px-8">
                  <MessageList messages={messages} loading={loading} />
                </div>
              )}

              {error && (
                <ErrorBanner
                  error={error}
                  onDismiss={() => setError(null)}
                />
              )}

              <ChatInput
                message={message}
                onMessageChange={setMessage}
                loading={loading}
                onSubmit={handleSubmit}
              />
            </>
          ) : activeWorkspace === 'history' ? (
            <>
              <HistoryWorkspace
                loading={loading}
                onSelectConversation={selectConversation}
              />

              {error && (
                <ErrorBanner
                  error={error}
                  onDismiss={() => setError(null)}
                />
              )}
            </>
          ) : activeWorkspace === 'memory' ? (
            <MemoryWorkspace />
          ) : (
            <VerificationWorkspace />
          )}
        </section>

        <footer className="flex shrink-0 items-center justify-between border-t border-[#242630] px-5 py-3 text-[10px] text-gray-600 md:px-8">
          <span>MiniMi Agent</span>
          <span>Evidence-first intelligence</span>
        </footer>
      </main>
    </div>
  )
}

export default App