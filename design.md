# Design Document — minimi-agent

**Status:** Draft, Milestone 0  
**Last updated:** 2026-11-10

## 1. Problem statement

Build a conversational research agent that can use web search, retain useful conversation and research history, and answer questions about what it previously found and whether that information has changed.

The challenge is not simply to call a search API. The system must connect historical context to current evidence while preserving provenance and time.

## 2. Scope

### In scope

- Conversational request handling.
- Four initial request intents: `RECALL`, `RESEARCH`, `VERIFY`, `COMPARE`.
- One external capability: web search.
- Persistent conversation and research history.
- Source URL and retrieval-time preservation.
- Comparison of historical claims with newly retrieved evidence.
- Evidence-grounded responses and explicit uncertainty.
- A local-first development workflow.

### Out of scope for the challenge MVP

- A macOS proactive assistant.
- Calendar, email, filesystem or notification integrations.
- Multiple collaborating agents.
- Autonomous unrestricted tool loops.
- Model training or fine-tuning.
- A distributed microservice deployment.

## 3. Initial non-functional requirements

- **Correctness:** Never invent a historical conversation or research snapshot.
- **Traceability:** Claims should be traceable to sources where available.
- **Temporal accuracy:** Distinguish event time, observation time and retrieval time.
- **Reliability:** Validate model output and handle tool failures.
- **Performance:** Bound model calls, search calls and retrieved context.
- **Cost:** Target zero paid infrastructure and paid API dependencies.
- **Maintainability:** Keep model, search, memory and orchestration behind interfaces.

Numeric latency and quality targets will be set after a baseline benchmark.

## 4. Proposed architecture

```text
Client
  |
  v
Fastify API
  |
  v
Agent Orchestrator
  |-- Intent classification (LLM adapter)
  |-- Memory retrieval (memory interface)
  |-- Search decision and tool execution
  |-- Evidence assembly
  |-- Response synthesis (LLM adapter)
  |
  +---- Memory Store (SQLite, planned)
  |
  +---- Web Search Tool (provider TBD)
  |
  +---- Local LLM (Ollama during development)
```

The orchestrator owns workflow control. The model may interpret language and produce structured proposals, but it does not receive unrestricted database or tool access.

## 5. Initial intent semantics

| Intent | Meaning | Typical memory need | Typical search need |
|---|---|---:|---:|
| `RECALL` | Retrieve historical conversation or research | Yes | No |
| `RESEARCH` | Find new information | Context-dependent | Yes |
| `VERIFY` | Retrieve a previous claim and check it against current evidence | Yes | Yes |
| `COMPARE` | Retrieve historical information and compare it with current information | Yes | Yes |

These are workflow defaults, not hard-coded universal truths. The final plan must account for the actual request and available evidence.

## 6. Memory model — proposed

The system must distinguish:

- **Conversation history:** user and assistant messages, ordered by timestamp.
- **Research run:** a bounded research operation with its query and execution time.
- **Source:** a URL and metadata captured during a research run.
- **Claim:** an atomic statement extracted from research.
- **Claim evidence:** the relationship between a claim and supporting or contradicting sources.

Temporal fields must not be conflated:

- `published_at` / `event_at`: when the source says an event happened, if known.
- `observed_at`: when the agent observed the information.
- `retrieved_at`: when the source was fetched.

A new observation must not overwrite the historical snapshot.

## 7. Interfaces and boundaries — to be specified

Planned interfaces:

- `LLMProvider`: generate structured intent and grounded responses.
- `SearchProvider`: return normalized search results.
- `ConversationRepository`: persist and retrieve messages.
- `ResearchRepository`: persist research runs, sources and claims.
- `AgentOrchestrator`: coordinate the request lifecycle.

Exact TypeScript contracts will be added after the data model and failure cases are reviewed.

## 8. Reliability and security considerations

- Treat model output, search snippets and web pages as untrusted data.
- Validate structured model output with runtime schemas.
- Apply timeouts and bounded retries to external calls.
- Do not execute instructions found in retrieved web content.
- Keep secrets in environment variables; never commit `.env`.
- Avoid logging sensitive conversation contents by default.
- Handle missing history honestly; do not fabricate recall.
- Distinguish “no change found” from “unable to verify”.

## 9. Technology decisions

| Area | Initial choice | Status |
|---|---|---|
| Language/runtime | TypeScript / Node.js | Selected |
| HTTP server | Fastify | Selected for foundation |
| Validation | Zod | Selected |
| Testing | Vitest | Selected |
| Local model runner | Ollama | Selected for development |
| Model | Qwen3.5 2B | Initial benchmark only |
| Database | SQLite + FTS5 | Proposed |
| SQLite driver | TBD | Open decision |
| Search | SearXNG candidate | Not finalized |
| Orchestration | Custom TypeScript | Proposed |

## 10. Open decisions

1. Which SQLite driver best fits Windows development and deployment?
2. Which search provider gives reliable results without paid API keys?
3. What normalized fields must every search result contain?
4. What retrieval strategy is sufficient before introducing embeddings?
5. What are the exact schemas for claims, sources and research runs?
6. What latency and answer-quality thresholds should the evaluation enforce?
7. How should ambiguous relative dates be resolved and clarified?

## 11. Evaluation plan

The first acceptance scenarios will reproduce the challenge examples:

1. Recall a specific question from a past date.
2. Retrieve a previous answer and verify it against current evidence.
3. Compare a historical shortlist with current product information.

Additional tests will cover missing history, stale sources, contradictory sources, search timeouts, malformed model output, and ambiguous dates.

## 12. Milestones

- M0 — Architecture and contracts.
- M1 — API and project foundation.
- M2 — Search adapter.
- M3 — Persistent conversation and research memory.
- M4 — Orchestration and grounded synthesis.
- M5 — Temporal verification and comparison.
- M6 — Evaluation, reliability and performance.
- M7 — Documentation and submission.

## 13. Architecture decision log

### ADR-001: Keep orchestration in application code

**Decision:** Use custom TypeScript orchestration initially.

**Reason:** The workflow is bounded and understandable. Application code should control persistence, validation, tool execution, retries and state transitions.

**Trade-off:** We own orchestration logic and tests instead of adopting a framework's abstractions.

### ADR-002: Keep the model replaceable

**Decision:** Access models through an `LLMProvider` interface.

**Reason:** Local hardware and model quality may require changing models. Core business logic should not depend on Ollama-specific response shapes.

**Trade-off:** A small adapter layer is required.

### ADR-003: Preserve historical research snapshots

**Decision:** Store new observations rather than overwriting old claims.

**Reason:** Verification and change detection require knowing what the system observed previously.

**Trade-off:** Storage grows over time; retention policy can be designed later.
