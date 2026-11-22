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

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-4">
      <form
        onSubmit={onSubmit}
        className="relative rounded-2xl border border-white/10 bg-[#17171c] shadow-lg transition focus-within:border-violet-500/40"
      >
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask MiniMi anything..."
          rows={1}
          disabled={loading}
          className="max-h-48 min-h-[56px] w-full resize-none bg-transparent px-5 py-4 pr-16 text-sm text-gray-200 outline-none placeholder:text-gray-500 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="absolute right-3 bottom-3 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      </form>

      <p className="mt-3 text-center text-[11px] text-gray-600">
        Enter to send · Shift + Enter for a new line
      </p>
    </div>
  )
}

export default ChatInput