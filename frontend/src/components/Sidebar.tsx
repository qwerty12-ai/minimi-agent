interface SidebarProps {
  loading: boolean
  onNewChat: () => void
  activeWorkspace: 'research' | 'history' | 'memory' | 'verification'
  onWorkspaceChange: (
    workspace: 'research' | 'history' | 'memory' | 'verification',
  ) => void
}

const navigation = [
  { id: 'research', label: 'Research', symbol: '⌕' },
  { id: 'history', label: 'History', symbol: '◷' },
  { id: 'memory', label: 'Memory', symbol: '◇' },
  { id: 'verification', label: 'Verification', symbol: '↔' },
] as const

function Sidebar({
  loading,
  onNewChat,
  activeWorkspace,
  onWorkspaceChange,
}: SidebarProps) {
  const workspaceClass = (
    workspace: 'research' | 'history' | 'memory' | 'verification',
  ) =>
    activeWorkspace === workspace
      ? 'flex w-full items-center gap-3 border-l-2 border-[var(--accent)] bg-[var(--surface-hover)] px-3 py-2.5 text-left text-sm text-[var(--text-primary)]'
      : 'flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-sidebar)] md:flex">
        <div className="flex h-14 items-center gap-3 border-b border-[var(--border-subtle)] px-5">
          <div className="grid h-7 w-7 place-items-center border border-[var(--border-strong)] text-xs font-semibold text-[var(--accent)]">
            M
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              MiniMi
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">
              Research workspace
            </div>
          </div>
        </div>

        <div className="px-4 pt-5">
          <button
            onClick={onNewChat}
            disabled={loading}
            className="flex w-full items-center justify-between border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <span className="text-[var(--accent)]">+</span>
              New research
            </span>

            <span className="text-[10px] text-[var(--text-muted)]">
              N
            </span>
          </button>
        </div>

        <div className="px-4 pt-7">
          <span className="mb-3 block px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Workspaces
          </span>

          <nav className="space-y-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  onWorkspaceChange(item.id)
                }
                disabled={loading}
                className={workspaceClass(item.id)}
              >
                <span className="w-5 text-center text-base text-[var(--accent)]">
                  {item.symbol}
                </span>

                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-[var(--border-subtle)] p-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--status-green)]" />

            <div>
              <div className="text-xs text-[var(--text-secondary)]">
                Running locally
              </div>

              <div className="text-[10px] text-[var(--text-muted)]">
                Private workspace
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile navigation */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface-sidebar)] md:hidden">
        <nav className="grid grid-cols-4">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => onWorkspaceChange(item.id)}
              disabled={loading}
              className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] transition-colors ${
                activeWorkspace === item.id
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <span className="text-lg leading-none">
                {item.symbol}
              </span>

              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  )
}

export default Sidebar