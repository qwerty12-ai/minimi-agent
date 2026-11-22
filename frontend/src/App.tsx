import { useState } from 'react'
import type { FormEvent } from 'react'
import { executeAgent } from './lib/api'
import Sidebar from './components/Sidebar'
import WelcomeScreen from './components/WelcomeScreen'
import ErrorBanner from './components/ErrorBanner'
import ChatInput from './components/ChatInput'
import MessageList from './components/MessageList'
import type { ChatMessage as ChatMessageType } from './components/types'

function App() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  function startNewChat() {
    if (loading) return

    setMessages([])
    setConversationId(undefined)
    setError(null)
    setMessage('')
  }

  return (
    <div className="flex min-h-screen bg-[#0c0d10] text-[#e5e7eb]">
      <Sidebar loading={loading} onNewChat={startNewChat} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#242630] px-5 md:px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Workspace</span>
            <span className="text-gray-700">/</span>
            <strong className="text-gray-200">Research</strong>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-[#254333] bg-[#14251c] px-3 py-1.5 text-[10px] font-semibold tracking-wider text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            LOCAL
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col">
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