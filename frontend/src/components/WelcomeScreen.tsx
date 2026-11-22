function WelcomeScreen() {
  return (
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
  )
}

export default WelcomeScreen