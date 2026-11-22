interface ErrorBannerProps {
  error: string
  onDismiss: () => void
}

function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  return (
    <div className="mx-auto mb-4 w-full max-w-4xl rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <div className="flex items-start justify-between gap-4">
        <p>{error}</p>

        <button
          onClick={onDismiss}
          className="shrink-0 text-red-400 transition hover:text-red-200"
          aria-label="Dismiss error"
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default ErrorBanner