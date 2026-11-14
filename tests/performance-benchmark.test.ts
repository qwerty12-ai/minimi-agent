import { describe, expect, it, vi } from "vitest";
import { performance } from "node:perf_hooks";

import { MemoryRetriever } from "../src/agent/memory-retriever.js";
import { ResearchExecutor } from "../src/agent/research-executor.js";
import { GroundedSynthesizer } from "../src/agent/grounded-synthesizer.js";
import { createAgent } from "../src/agent/create-agent.js";
import { createAgentInfrastructure } from "../src/agent/create-agent-infrastructure.js";

import type { IntentClassifier } from "../src/agent/types.js";
import type { LLMProvider } from "../src/llm/llm-provider.js";
import type { MemorySearchRepository } from "../src/memory/types.js";
import type { SearchService } from "../src/research/search-service.js";
import type { SearchResponse } from "../src/research/types.js";
import type { AgentResponse, SynthesisRequest } from "../src/agent/orchestration-types.js";

const timestamp = "2026-11-14T10:00:00.000Z";

const searchResponse: SearchResponse = {
  query: "TypeScript documentation",
  provider: "benchmark",
  searchedAt: timestamp,
  results: [
    {
      title: "TypeScript Documentation",
      url: "https://www.typescriptlang.org/",
      snippet: "TypeScript is a strongly typed programming language.",
      source: "benchmark",
    },
  ],
};

const synthesisRequest: SynthesisRequest = {
  question: "What is TypeScript?",
  intent: "RESEARCH",
  evidence: {
    collectedAt: timestamp,
    items: [
      {
        id: "research_result:https://www.typescriptlang.org/",
        sourceType: "research_result",
        sourceId: "https://www.typescriptlang.org/",
        content: "TypeScript is a strongly typed programming language.",
        createdAt: timestamp,
        title: "TypeScript Documentation",
        sourceUrl: "https://www.typescriptlang.org/",
      },
    ],
  },
};

const synthesisResponse: AgentResponse = {
  answer: "TypeScript is a strongly typed programming language.",
  intent: "RESEARCH",
  status: "supported",
  citations: [
    {
      evidenceId: "research_result:https://www.typescriptlang.org/",
    },
  ],
  generatedAt: timestamp,
};

const classifier: IntentClassifier = {
  classify: vi.fn().mockResolvedValue({
    intent: "RESEARCH",
  }),
};

const llm: LLMProvider = {
  generateStructured: vi.fn().mockResolvedValue(synthesisResponse),
};

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(percentileValue * sorted.length) - 1;

  return sorted[Math.max(0, index)] ?? 0;
}

async function benchmark(
  name: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  const warmupIterations = 5;
  const measuredIterations = 30;

  for (let index = 0; index < warmupIterations; index += 1) {
    await operation();
  }

  const durations: number[] = [];

  for (let index = 0; index < measuredIterations; index += 1) {
    const start = performance.now();

    await operation();

    durations.push(performance.now() - start);
  }

  const average =
    durations.reduce((sum, duration) => sum + duration, 0) /
    durations.length;

  console.info(
    [
      `[M6.4 Benchmark] ${name}`,
      `samples=${measuredIterations}`,
      `average=${average.toFixed(3)}ms`,
      `p50=${percentile(durations, 0.50).toFixed(3)}ms`,
      `p95=${percentile(durations, 0.95).toFixed(3)}ms`,
    ].join(" | "),
  );
}

describe("M6.4 Performance Benchmarks", () => {
  it("benchmarks memory retrieval latency", async () => {
    const repository: MemorySearchRepository = {
      search: vi.fn().mockResolvedValue([
        {
          sourceType: "memory_record",
          sourceId: "memory-1",
          content: "TypeScript is a strongly typed programming language.",
          createdAt: timestamp,
          rank: 0.95,
          kind: "fact",
        },
      ]),
    };

    const retriever = new MemoryRetriever(
      repository,
      () => new Date(timestamp),
    );

    await benchmark("Memory retrieval", () =>
      retriever.retrieve("TypeScript"),
    );

    expect(repository.search).toHaveBeenCalled();
  });

  it("benchmarks research execution latency", async () => {
    const searchService: Pick<SearchService, "search"> = {
      search: vi.fn().mockResolvedValue(searchResponse),
    };

    const executor = new ResearchExecutor(
      searchService,
      () => new Date(timestamp),
    );

    await benchmark("Research execution", () =>
      executor.execute("TypeScript documentation", {
        intent: "RESEARCH",
        requiresMemory: false,
        requiresSearch: true,
      }),
    );

    expect(searchService.search).toHaveBeenCalled();
  });

  it("benchmarks grounded synthesis latency", async () => {
    const provider: LLMProvider = {
      generateStructured: vi.fn().mockResolvedValue(synthesisResponse),
    };

    const synthesizer = new GroundedSynthesizer(
      provider,
      () => new Date(timestamp),
    );

    await benchmark("Grounded synthesis", () =>
      synthesizer.synthesize(synthesisRequest),
    );

    expect(provider.generateStructured).toHaveBeenCalled();
  });

  it("benchmarks complete agent execution latency", async () => {
    const infrastructure = createAgentInfrastructure({
      databasePath: ":memory:",
      searxngBaseUrl: "http://localhost:8080",
      searchFetch: vi.fn(async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                title: "TypeScript Documentation",
                url: "https://www.typescriptlang.org/",
                content: "TypeScript is a strongly typed programming language.",
                engine: "benchmark",
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      ) as unknown as typeof fetch,
    });

    const agent = createAgent({
      infrastructure,
      classifier,
      llm,
      clock: () => new Date(timestamp),
    });

    try {
      await benchmark("Complete agent execution", () =>
        agent.execute({
          message: "Find TypeScript documentation.",
        }),
      );
    } finally {
      agent.close();
      infrastructure.close();
    }
  });
});