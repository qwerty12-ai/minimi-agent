function LoadingIndicator() {
  return (
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
  )
}

export default LoadingIndicator