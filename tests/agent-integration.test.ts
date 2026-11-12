import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgent } from "../src/agent/create-agent.js";
import { createAgentInfrastructure } from "../src/agent/create-agent-infrastructure.js";

import type { ResearchSnapshot } from "../src/memory/types.js";

describe("Agent Integration", () => {
  let directory: string | undefined;

  const generationTime = "2026-11-12T10:00:00.000Z";
  const conversationId = "verification-conversation";
  const historicalSnapshotId = "historical-snapshot";

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();

    if (directory) {
      rmSync(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  function createTestDirectory(): string {
    directory = mkdtempSync(
      join(tmpdir(), "minimi-agent-integration-"),
    );
    return directory;
  }

  function mockFetch() {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/api/chat")) {
          const payload = JSON.parse(String(init?.body ?? "{}"));
          const systemMessage = payload.messages?.[0]?.content ?? "";

          const content = systemMessage.includes("intent")
            ? { intent: "RESEARCH" }
            : {
                answer: "TypeScript is a strongly typed programming language.",
                intent: "RESEARCH",
                status: "supported",
                citations: [],
                generatedAt: generationTime,
              };

          return new Response(
            JSON.stringify({
              message: { content: JSON.stringify(content) },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function createSearchResponse(
    results: Array<{
      title: string;
      url: string;
      content: string;
      engine?: string;
    }>,
  ): Response {
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function createInfrastructure(searchFetch: typeof fetch) {
    const databasePath = join(
      createTestDirectory(),
      "data",
      "minimi-agent.db",
    );

    return createAgentInfrastructure({
      databasePath,
      searxngBaseUrl: "http://localhost:8080",
      searchFetch,
    });
  }

  async function seedHistoricalResearch(
    infrastructure: ReturnType<typeof createAgentInfrastructure>,
    options: {
      id?: string;
      conversationId?: string;
      results?: ResearchSnapshot["results"];
    } = {},
  ): Promise<ResearchSnapshot> {
    const snapshotConversationId =
      options.conversationId ?? conversationId;

    await infrastructure.memoryStore.conversations.create({
      id: snapshotConversationId,
      title: "Historical research",
      createdAt: generationTime,
      updatedAt: generationTime,
    });

    const snapshot: ResearchSnapshot = {
      id: options.id ?? historicalSnapshotId,
      conversationId: snapshotConversationId,
      query: "Find TypeScript documentation.",
      provider: "searxng",
      searchedAt: generationTime,
      recordedAt: generationTime,
      results: options.results ?? [
        {
          title: "TypeScript Documentation",
          url: "https://www.typescriptlang.org/",
          snippet: "Official TypeScript documentation.",
          source: "test-engine",
        },
      ],
    };

    await infrastructure.memoryStore.researchSnapshots.save(snapshot);
    return snapshot;
  }

  it("executes the complete research pipeline and persists its conversation", async () => {
    mockFetch();

    const infrastructure = createInfrastructure(
      vi.fn(async () =>
        createSearchResponse([
          {
            title: "TypeScript Documentation",
            url: "https://www.typescriptlang.org/",
            content: "Official TypeScript documentation.",
            engine: "test-engine",
          },
        ]),
      ) as unknown as typeof fetch,
    );

    const agent = createAgent({
      infrastructure,
      clock: () => new Date(generationTime),
    });

    try {
      const response = await agent.execute({
        message: "Find TypeScript documentation.",
      });

      expect(response).toMatchObject({
        intent: "RESEARCH",
        status: "supported",
        answer: "TypeScript is a strongly typed programming language.",
        conversationId: expect.any(String),
      });

      const conversation =
        await infrastructure.memoryStore.conversations.findById(
          response.conversationId,
        );

      expect(conversation).not.toBeNull();

      const messages =
        await infrastructure.memoryStore.conversations.getMessages(
          response.conversationId,
        );

      expect(messages).toHaveLength(2);
      expect(messages.map((message) => message.role)).toEqual([
        "user",
        "assistant",
      ]);

      const snapshots =
        await infrastructure.memoryStore.researchSnapshots.findByConversation(
          response.conversationId,
        );

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].query).toBe(
        "Find TypeScript documentation.",
      );
    } finally {
      agent.close();
      infrastructure.close();
    }
  });

  it("verifies unchanged evidence and persists snapshots, comparisons, and verification", async () => {
    const infrastructure = createInfrastructure(
      vi.fn(async () =>
        createSearchResponse([
          {
            title: "TypeScript Documentation",
            url: "https://www.typescriptlang.org/",
            content: "Official TypeScript documentation.",
            engine: "test-engine",
          },
        ]),
      ) as unknown as typeof fetch,
    );

    const historical = await seedHistoricalResearch(infrastructure);
    const agent = createAgent({
      infrastructure,
      clock: () => new Date(generationTime),
    });

    try {
      const result = await agent.verify({
        historicalSnapshotId: historical.id,
        conversationId,
      });

      expect(result.verification).toMatchObject({
        historicalSnapshotId: historical.id,
        conversationId,
        query: historical.query,
        status: "unchanged",
        findings: [
          {
            status: "unchanged",
            historicalEvidenceIds: expect.any(Array),
            currentEvidenceIds: expect.any(Array),
          },
        ],
      });

      expect(result.verification.currentSnapshotId).toEqual(
        expect.any(String),
      );
      expect(result.comparisons).toHaveLength(1);
      expect(result.comparisons[0].status).toBe("unchanged");

      const persistedVerification =
        await infrastructure.verificationRepository.findVerificationResult(
          result.verification.id,
        );

      expect(persistedVerification).toEqual(result.verification);

      const persistedComparisons =
        await infrastructure.verificationRepository.findComparisonResults(
          historical.id,
          result.verification.currentSnapshotId!,
        );

      expect(persistedComparisons).toEqual(result.comparisons);

      const snapshots =
        await infrastructure.memoryStore.researchSnapshots.findByConversation(
          conversationId,
        );

      expect(snapshots).toHaveLength(2);
      expect(
        snapshots.some(
          (snapshot) =>
            snapshot.id === result.verification.currentSnapshotId,
        ),
      ).toBe(true);
    } finally {
      agent.close();
      infrastructure.close();
    }
  });

  it("detects changed evidence and persists the comparison", async () => {
    const infrastructure = createInfrastructure(
      vi.fn(async () =>
        createSearchResponse([
          {
            title: "TypeScript Documentation - Updated",
            url: "https://www.typescriptlang.org/",
            content: "Updated TypeScript documentation.",
            engine: "test-engine",
          },
        ]),
      ) as unknown as typeof fetch,
    );

    const historical = await seedHistoricalResearch(infrastructure);
    const agent = createAgent({
      infrastructure,
      clock: () => new Date(generationTime),
    });

    try {
      const result = await agent.verify({
        historicalSnapshotId: historical.id,
        conversationId,
      });

      expect(result.verification.status).toBe("changed");
      expect(result.verification.findings).toHaveLength(1);
      expect(result.verification.findings[0].status).toBe("changed");
      expect(result.comparisons).toHaveLength(1);
      expect(result.comparisons[0].status).toBe("changed");

      const persisted =
        await infrastructure.verificationRepository.findVerificationResult(
          result.verification.id,
        );

      expect(persisted?.status).toBe("changed");
    } finally {
      agent.close();
      infrastructure.close();
    }
  });

  it("preserves the missing historical snapshot cause", async () => {
    const infrastructure = createInfrastructure(
      vi.fn(async () =>
        createSearchResponse([]),
      ) as unknown as typeof fetch,
    );

    const agent = createAgent({
      infrastructure,
      clock: () => new Date(generationTime),
    });

    try {
      await expect(
        agent.verify({
          historicalSnapshotId: "missing-snapshot",
        }),
      ).rejects.toMatchObject({
        message: "Failed to retrieve historical research.",
        cause: expect.objectContaining({
          message:
            "Historical research snapshot 'missing-snapshot' was not found.",
        }),
      });
    } finally {
      agent.close();
      infrastructure.close();
    }
  });

  it("preserves the historical conversation ownership error", async () => {
    const infrastructure = createInfrastructure(
      vi.fn(async () =>
        createSearchResponse([]),
      ) as unknown as typeof fetch,
    );

    const historical = await seedHistoricalResearch(infrastructure, {
      conversationId: "original-conversation",
    });

    const agent = createAgent({
      infrastructure,
      clock: () => new Date(generationTime),
    });

    try {
      await expect(
        agent.verify({
          historicalSnapshotId: historical.id,
          conversationId: "different-conversation",
        }),
      ).rejects.toMatchObject({
        message: "Failed to retrieve historical research.",
        cause: expect.objectContaining({
          message: expect.stringContaining(
            "does not belong to conversation",
          ),
        }),
      });
    } finally {
      agent.close();
      infrastructure.close();
    }
  });

  it("propagates fresh research failures without persisting verification results", async () => {
    const infrastructure = createInfrastructure(
      vi.fn(async () => {
        throw new Error("Search service unavailable.");
      }) as unknown as typeof fetch,
    );

    const historical = await seedHistoricalResearch(infrastructure);
    const agent = createAgent({
      infrastructure,
      clock: () => new Date(generationTime),
    });

    try {
      await expect(
        agent.verify({
          historicalSnapshotId: historical.id,
          conversationId,
        }),
      ).rejects.toThrow("Failed to execute fresh research.");

      const snapshots =
        await infrastructure.memoryStore.researchSnapshots.findByConversation(
          conversationId,
        );

      expect(snapshots).toHaveLength(1);
    } finally {
      agent.close();
      infrastructure.close();
    }
  });

  it("returns and persists an inconclusive result when fresh research finds no evidence", async () => {
    const infrastructure = createInfrastructure(
      vi.fn(async () =>
        createSearchResponse([]),
      ) as unknown as typeof fetch,
    );

    const historical = await seedHistoricalResearch(infrastructure);
    const agent = createAgent({
      infrastructure,
      clock: () => new Date(generationTime),
    });

    try {
      const result = await agent.verify({
        historicalSnapshotId: historical.id,
        conversationId,
      });

      expect(result.comparisons).toHaveLength(1);
      expect(result.comparisons[0].status).toBe("historical_only");
      expect(result.verification.status).toBe("inconclusive");
      expect(result.verification.findings[0].status).toBe(
        "inconclusive",
      );

      const persisted =
        await infrastructure.verificationRepository.findVerificationResult(
          result.verification.id,
        );

      expect(persisted?.status).toBe("inconclusive");
    } finally {
      agent.close();
      infrastructure.close();
    }
  });
});