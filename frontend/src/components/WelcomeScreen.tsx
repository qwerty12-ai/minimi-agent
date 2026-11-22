function WelcomeScreen() {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-10 sm:px-8">
      <div className="w-full max-w-3xl">
        <div className="mb-10">
          <div className="mb-5 flex items-center gap-2">
            <span className="h-2 w-2 bg-[var(--accent)]" />

            <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Research workspace
            </span>
          </div>

          <h1 className="max-w-2xl text-3xl font-medium leading-tight tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Start with a question.
            <br />

            <span className="text-[var(--text-secondary)]">
              Work through the evidence.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
            Research across sources, build evidence-backed answers,
            revisit previous findings and verify how information
            changes over time.
          </p>
        </div>

        <div className="border-y border-[var(--border-subtle)]">
          <div className="grid grid-cols-[36px_1fr] gap-4 border-b border-[var(--border-subtle)] py-5">
            <span className="text-lg text-[var(--accent)]">
              ⌕
            </span>

            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)]">
                Research
              </h2>

              <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                Gather information from web sources and synthesize
                findings with supporting evidence.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[36px_1fr] gap-4 border-b border-[var(--border-subtle)] py-5">
            <span className="text-lg text-[var(--accent)]">
              ◇
            </span>

            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)]">
                Memory
              </h2>

              <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                Search stored knowledge and previously discussed
                information across your workspace.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[36px_1fr] gap-4 py-5">
            <span className="text-lg text-[var(--accent)]">
              ↔
            </span>

            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)]">
                Verification
              </h2>

              <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                Revisit historical research and compare it against
                fresh evidence to identify changes.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="border border-[var(--border-subtle)] px-2.5 py-1.5">
            Source-grounded
          </span>

          <span className="border border-[var(--border-subtle)] px-2.5 py-1.5">
            Persistent history
          </span>

          <span className="border border-[var(--border-subtle)] px-2.5 py-1.5">
            Temporal verification
          </span>
        </div>
      </div>
    </div>
  )
}

export default WelcomeScreen