import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { executeAgent, type AgentResponse } from './lib/api'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  response?: AgentResponse
}

function App() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedMessage = message.trim()

    if (!trimmedMessage || loading) return

    const userMessage: ChatMessage = {
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
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#242630] bg-[#101116] p-5 md:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 font-semibold text-white">
            M
          </div>
          <div>
            <h2 className="font-semibold text-white">MiniMi</h2>
            <span className="text-xs text-gray-500">Research Agent</span>
          </div>
        </div>

        <button
          onClick={startNewChat}
          disabled={loading}
          className="mb-8 flex items-center gap-2 rounded-xl border border-[#343541] bg-[#1b1c23] px-4 py-3 text-sm text-gray-200 transition hover:bg-[#252630] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-lg">＋</span>
          New conversation
        </button>

        <div>
          <span className="mb-3 block text-[10px] font-semibold tracking-[0.18em] text-gray-500">
            WORKSPACE
          </span>

          <nav className="space-y-1">
            <button className="flex w-full items-center gap-3 rounded-lg bg-[#24232f] px-3 py-2.5 text-left text-sm text-violet-300">
              <span>◈</span> Research
            </button>
            <button
              disabled
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-500"
            >
              <span>◷</span> History
            </button>
            <button
              disabled
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-500"
            >
              <span>⌘</span> Memory
            </button>
            <button
              disabled
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-500"
            >
              <span>⇄</span> Verification
            </button>
          </nav>
        </div>

        <div className="mt-auto border-t border-[#242630] pt-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#292a35] text-sm">
              M
            </div>
            <div className="min-w-0">
              <strong className="block text-sm text-gray-200">MiniMi Agent</strong>
              <span className="text-xs text-gray-500">Local workspace</span>
            </div>
          </div>
        </div>
      </aside>

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
            <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-12">
              <div className="w-full max-w-3xl">
                <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-semibold text-white shadow-lg shadow-violet-950/30">
                  M
                </div>

                <div className="text-center">
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-violet-400">
                    YOUR RESEARCH ASSISTANT
                  </span>
                  <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    Think deeper.
                    <br />
                    <span className="text-gray-400">Find the evidence.</span>
                  </h1>
                  <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-gray-400">
                    MiniMi researches questions using web search,
                    evidence-grounded synthesis, persistent memory and temporal
                    verification.
                  </p>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#292a34] bg-[#14151b] p-5 transition hover:border-[#454354]">
                    <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-xl text-blue-400">
                      ⌕
                    </div>
                    <h3 className="text-sm font-semibold text-gray-200">
                      Web research
                    </h3>
                    <p className="mt-2 text-xs leading-6 text-gray-500">
                      Search the web and collect supporting evidence.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#292a34] bg-[#14151b] p-5 transition hover:border-[#454354]">
                    <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-xl text-violet-400">
                      ◈
                    </div>
                    <h3 className="text-sm font-semibold text-gray-200">
                      Persistent memory
                    </h3>
                    <p className="mt-2 text-xs leading-6 text-gray-500">
                      Keep research and conversations across sessions.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#292a34] bg-[#14151b] p-5 transition hover:border-[#454354]">
                    <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-xl text-emerald-400">
                      ↻
                    </div>
                    <h3 className="text-sm font-semibold text-gray-200">
                      Verify over time
                    </h3>
                    <p className="mt-2 text-xs leading-6 text-gray-500">
                      Compare historical findings with fresh evidence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-5 py-8 md:px-8">
              {messages.map((chatMessage) => (
                <article
                  key={chatMessage.id}
                  className="mb-10 flex items-start gap-4"
                >
                  <div
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-semibold ${chatMessage.role === 'assistant'
                        ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
                        : 'bg-[#292a35] text-gray-300'
                      }`}
                  >
                    {chatMessage.role === 'assistant' ? 'M' : 'Y'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-3 text-xs font-semibold text-gray-300">
                      {chatMessage.role === 'assistant' ? 'MiniMi' : 'You'}
                    </div>

                    {chatMessage.role === 'user' ? (
                      <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-100">
                        {chatMessage.content}
                      </div>
                    ) : (
                      <div className="markdown-content break-words text-sm leading-7 text-gray-300">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => (
                              <h1 className="mb-4 mt-7 text-2xl font-semibold text-white">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="mb-3 mt-7 text-xl font-semibold text-white">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="mb-3 mt-5 text-lg font-semibold text-gray-100">
                                {children}
                              </h3>
                            ),
                            h4: ({ children }) => (
                              <h4 className="mb-2 mt-4 font-semibold text-gray-100">
                                {children}
                              </h4>
                            ),
                            p: ({ children }) => (
                              <p className="mb-4 leading-7">{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul className="mb-4 list-disc space-y-2 pl-6">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mb-4 list-decimal space-y-2 pl-6">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="pl-1 leading-7">{children}</li>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="my-5 border-l-2 border-violet-500 bg-[#171923] py-3 pl-4 pr-3 text-gray-400">
                                {children}
                              </blockquote>
                            ),
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-violet-300 underline decoration-violet-400/40 underline-offset-4 hover:text-violet-200"
                              >
                                {children}
                              </a>
                            ),
                            code: ({ className, children }) => {
                              const isBlock = Boolean(className)

                              return isBlock ? (
                                <code className={className}>{children}</code>
                              ) : (
                                <code className="rounded-md border border-[#343541] bg-[#252630] px-1.5 py-0.5 font-mono text-[0.85em] text-violet-200">
                                  {children}
                                </code>
                              )
                            },
                            pre: ({ children }) => (
                              <pre className="my-5 overflow-x-auto rounded-xl border border-[#30333d] bg-[#14151b] p-4 text-xs leading-6">
                                {children}
                              </pre>
                            ),
                            table: ({ children }) => (
                              <div className="my-5 overflow-x-auto rounded-xl border border-[#343541]">
                                <table className="w-full border-collapse text-left text-xs">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-[#242630] text-gray-100">
                                {children}
                              </thead>
                            ),
                            th: ({ children }) => (
                              <th className="border-b border-[#343541] px-4 py-3 font-semibold">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border-b border-[#30333d] px-4 py-3 align-top text-gray-300">
                                {children}
                              </td>
                            ),
                            hr: () => (
                              <hr className="my-7 border-[#30333d]" />
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-gray-100">
                                {children}
                              </strong>
                            ),
                          }}
                        >
                          {chatMessage.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {chatMessage.response && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                        <span
                          className={`rounded-md border px-2 py-1 capitalize ${chatMessage.response.status === 'supported'
                              ? 'border-emerald-900 bg-emerald-950/40 text-emerald-400'
                              : chatMessage.response.status ===
                                'partially_supported'
                                ? 'border-amber-900 bg-amber-950/30 text-amber-400'
                                : 'border-[#353641] bg-[#20212a] text-gray-400'
                            }`}
                        >
                          {chatMessage.response.status.replaceAll('_', ' ')}
                        </span>
                        <span>
                          {chatMessage.response.citations.length} citations
                        </span>
                        <span className="border-l border-[#30333c] pl-2">
                          {chatMessage.response.intent.replaceAll('_', ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {loading && (
                <div className="mb-8 flex items-start gap-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white">
                    M
                  </div>
                  <div>
                    <div className="mb-3 text-xs font-semibold text-gray-300">
                      MiniMi
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400 [animation-delay:300ms]" />
                      </div>
                      Researching and synthesizing...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mx-auto mb-4 flex w-full max-w-4xl items-start gap-3 rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-red-300"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-red-900/40 text-xs font-bold">
                !
              </span>
              <div className="min-w-0 flex-1">
                <strong className="text-xs">Request failed</strong>
                <p className="mt-1 break-words text-xs leading-5 text-red-300/80">
                  {error}
                </p>
              </div>
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                className="text-lg text-red-300/70 hover:text-red-200"
              >
                ×
              </button>
            </div>
          )}

          <div className="mx-auto w-full max-w-4xl px-5 pb-4 md:px-8">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-[#343541] bg-[#17181f] shadow-xl shadow-black/10 transition focus-within:border-[#565267]"
            >
              <textarea
                placeholder="Ask MiniMi anything..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                rows={3}
                disabled={loading}
                className="w-full resize-none bg-transparent px-5 py-4 text-sm leading-7 text-gray-200 outline-none placeholder:text-gray-500 disabled:opacity-50"
              />

              <div className="flex items-center justify-between border-t border-[#292a34] px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="text-violet-400">◈</span>
                    Evidence grounded
                  </span>
                  <span className="text-gray-700">·</span>
                  <span className="flex items-center gap-1.5">
                    <span>⌕</span>
                    Web research
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!message.trim() || loading}
                  aria-label="Send message"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-lg text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-[#30313b] disabled:text-gray-500"
                >
                  {loading ? '…' : '↑'}
                </button>
              </div>
            </form>

            <p className="mt-3 text-center text-[10px] text-gray-600">
              Responses are generated locally using your configured agent
              infrastructure.
            </p>
          </div>
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