import type { FormEvent, KeyboardEvent } from 'react'

interface ChatInputProps {
  message: string
  onMessageChange: (value: string) => void
  loading: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function ChatInput({
  message,
  onMessageChange,
  loading,
  onSubmit,
}: ChatInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()

      if (!loading && message.trim()) {
        event.currentTarget.form?.requestSubmit()
      }
    }
  }

  const handleChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const textarea = event.currentTarget

    onMessageChange(textarea.value)

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 192)}px`
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-3 pt-3 sm:px-6 sm:pb-4">
      <form
        onSubmit={onSubmit}
        className="relative border border-[var(--border-strong)] bg-[var(--surface-input)] transition-colors focus-within:border-[var(--accent-muted)]"
      >
        <textarea
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a research question..."
          rows={1}
          disabled={loading}
          className="max-h-48 min-h-[54px] w-full resize-none overflow-y-auto bg-transparent px-4 py-3.5 pr-14 text-sm leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:opacity-50 sm:px-5"
        />

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--accent)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)] disabled:opacity-50"
          aria-label="Send message"
        >
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)]" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          )}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
        <span>Enter to send · Shift + Enter for a new line</span>
        <span className="hidden sm:inline">Evidence-first research</span>
      </div>
    </div>
  )
}

export default ChatInput