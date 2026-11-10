# minimi-agent

An evidence-grounded conversational research agent with persistent memory, temporal reasoning, and web search.

> **Status:** Early development — Milestone 0 / foundation.
>
> This repository is being built incrementally. The current code is a minimal, testable Node.js API foundation, not a completed AI agent.

## Goals

- Recall relevant historical conversations.
- Research current information through one web-search tool.
- Verify old claims against current evidence.
- Compare historical research snapshots with current information.
- Preserve source URLs and observation timestamps.
- Produce concise answers grounded in retrieved evidence.

## Technology

- TypeScript and Node.js
- Fastify for the HTTP API
- Zod for runtime validation
- Ollama for local model inference during development
- SQLite with FTS5 planned for persistent memory
- Vitest for tests

The search provider and SQLite driver are intentionally not finalized yet. We will choose them after documenting the requirements and testing the trade-offs.

## Requirements

- Node.js 22 or newer
- npm
- Ollama (optional at this foundation stage)

## Setup

```powershell
git clone <your-repository-url>
cd minimi-agent
npm install
Copy-Item .env.example .env
npm run dev
```

The API listens on `http://127.0.0.1:3000` by default.

## Verify

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Run checks:

```powershell
npm run typecheck
npm test
npm run build
```

## Project structure

```text
minimi-agent/
├── src/
│   ├── agent/       # Intent handling and orchestration
│   ├── api/         # HTTP routes and schemas
│   ├── config/      # Environment configuration
│   ├── database/    # Persistence adapters and migrations
│   ├── llm/         # Model-provider interface and Ollama adapter
│   ├── memory/      # Conversation and research retrieval
│   ├── research/    # Claims, evidence and temporal comparison
│   ├── tools/       # Web-search tool and provider adapters
│   ├── app.ts       # Fastify application factory
│   └── index.ts     # Process entry point
├── tests/
├── design.md
├── .env.example
└── package.json
```

## Architecture

Read [`design.md`](./design.md) before implementation. It records the problem boundaries, initial architecture, decisions, open questions, and milestone plan.

## Current implementation

- [x] TypeScript project foundation
- [x] Fastify application factory
- [x] Health endpoint
- [x] Environment validation
- [x] Automated health-route test
- [ ] Conversation persistence
- [ ] Search provider
- [ ] LLM adapter
- [ ] Agent orchestration
- [ ] Temporal verification and comparison

## Development principles

1. Keep the LLM replaceable.
2. Keep tool execution under application control.
3. Treat model output as untrusted input and validate it.
4. Store evidence with provenance and timestamps.
5. Prefer deterministic code for deterministic decisions.
6. Add dependencies only when a concrete requirement justifies them.
7. Test failure paths, not only happy paths.

## License

License to be selected before public release. Do not assume this project is open source until a license file is added.