interface SidebarProps {
  loading: boolean
  onNewChat: () => void
}

function Sidebar({ loading, onNewChat }: SidebarProps) {
  return (
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
        onClick={onNewChat}
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
            <strong className="block text-sm text-gray-200">
              MiniMi Agent
            </strong>
            <span className="text-xs text-gray-500">Local workspace</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar