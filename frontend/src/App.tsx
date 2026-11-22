import { useState } from 'react'
import { executeAgent, type AgentResponse } from './lib/api'
import './App.css'

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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">M</div>
          <div>
            <h2>MiniMi</h2>
            <span>Research Agent</span>
          </div>
        </div>

        <button className="new-chat" onClick={startNewChat}>
          <span>＋</span> New conversation
        </button>

        <div className="sidebar-section">
          <span className="section-label">WORKSPACE</span>
          <button className="nav-item active">
            <span>◈</span> Research
          </button>
          <button className="nav-item">
            <span>◷</span> History
          </button>
          <button className="nav-item">
            <span>⌘</span> Memory
          </button>
          <button className="nav-item">
            <span>⇄</span> Verification
          </button>
        </div>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">M</div>
            <div className="profile-text">
              <strong>MiniMi Agent</strong>
              <span>Local workspace</span>
            </div>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Research</strong>
          </div>

          <div className="topbar-right">
            <span className="environment-badge">
              <span className="environment-dot" />
              LOCAL
            </span>
          </div>
        </header>

        <section className={`workspace ${messages.length ? 'chat-active' : ''}`}>
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-mark">M</div>
              <span className="eyebrow">YOUR RESEARCH ASSISTANT</span>
              <h1>Think deeper.<br />Find the evidence.</h1>
              <p className="welcome-description">
                MiniMi researches questions using web search, evidence-grounded
                synthesis, persistent memory and temporal verification.
              </p>

              <div className="capability-grid">
                <div className="capability-card">
                  <div className="capability-icon search-icon">⌕</div>
                  <h3>Web research</h3>
                  <p>Search the web and collect supporting evidence.</p>
                </div>

                <div className="capability-card">
                  <div className="capability-icon memory-icon">◈</div>
                  <h3>Persistent memory</h3>
                  <p>Keep research and conversations across sessions.</p>
                </div>

                <div className="capability-card">
                  <div className="capability-icon verify-icon">↻</div>
                  <h3>Verify over time</h3>
                  <p>Compare historical findings with fresh evidence.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {messages.map((chatMessage) => (
                <article
                  key={chatMessage.id}
                  className={`message-row ${chatMessage.role}`}
                >
                  <div className="message-avatar">
                    {chatMessage.role === 'assistant' ? 'M' : 'Y'}
                  </div>

                  <div className="message-content">
                    <div className="message-author">
                      {chatMessage.role === 'assistant' ? 'MiniMi' : 'You'}
                    </div>

                    <div className="message-text">
                      {chatMessage.content}
                    </div>

                    {chatMessage.response && (
                      <div className="response-meta">
                        <span className={`response-status ${chatMessage.response.status}`}>
                          {chatMessage.response.status.replaceAll('_', ' ')}
                        </span>
                        <span>
                          {chatMessage.response.citations.length} citations
                        </span>
                        <span>
                          {chatMessage.response.intent.replaceAll('_', ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {loading && (
                <div className="message-row assistant">
                  <div className="message-avatar">M</div>
                  <div className="message-content">
                    <div className="message-author">MiniMi</div>
                    <div className="loading-indicator">
                      <span />
                      <span />
                      <span />
                      <span className="loading-label">
                        Researching and synthesizing...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="chat-end" />
            </div>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <span>!</span>
              <div>
                <strong>Request failed</strong>
                <p>{error}</p>
              </div>
              <button onClick={() => setError(null)} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}

          <div className="composer-container">
            <form className="composer" onSubmit={handleSubmit}>
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
              />

              <div className="composer-footer">
                <div className="composer-context">
                  <span className="context-item">◈ Evidence grounded</span>
                  <span className="context-divider">·</span>
                  <span className="context-item">⌕ Web research</span>
                </div>

                <button
                  className="send-button"
                  type="submit"
                  disabled={!message.trim() || loading}
                  aria-label="Send message"
                >
                  {loading ? '…' : '↑'}
                </button>
              </div>
            </form>

            <p className="composer-disclaimer">
              Responses are generated locally using your configured agent
              infrastructure.
            </p>
          </div>
        </section>

        <footer className="main-footer">
          <span>MiniMi Agent</span>
          <span>Evidence-first intelligence</span>
        </footer>
      </main>
    </div>
  )
}

export default App