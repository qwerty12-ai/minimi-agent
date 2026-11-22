import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  mkdtempSync,
  rmSync,
} from "node:fs";

import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgent } from "../src/agent/create-agent.js";
import { createAgentInfrastructure } from "../src/agent/create-agent-infrastructure.js";

import { AgentPersistenceError } from "../src/agent/create-agent.js"

import type { IntentClassifier } from "../src/agent/types.js";
import type { LLMProvider } from "../src/llm/llm-provider.js";

const timestamp = "2026-11-14T10:00:00.000Z";

describe("Agent Failure Recovery", () => {
  let directory: string | undefined;

  afterEach(() => {
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  function createTestDirectory(): string {
    directory = mkdtempSync(
      join(tmpdir(), "minimi-agent-failure-"),
    );

    return directory;
  }

  function createInfrastructure() {
    return createAgentInfrastructure({
      databasePath: join(
        createTestDirectory(),
        "data",
        "minimi-agent.db",
      ),
      searxngBaseUrl: "http://localhost:8080",
    });
  }

  function createClassifier(intent: string): IntentClassifier {
    return {
      classify: vi.fn().mockResolvedValue({ intent }),
    } as unknown as IntentClassifier;
  }

  function createLLM(): LLMProvider {
    return {
      generateStructured: vi.fn().mockResolvedValue({
        answer: "There is insufficient evidence.",
        intent: "RESEARCH",
        status: "insufficient_evidence",
        citations: [],
        generatedAt: timestamp,
      }),
    };
  }

  it("does not persist messages when classification fails", async () => {
    const infrastructure = createInfrastructure();
    const classificationError = new Error(
      "Intent classifier unavailable.",
    );

    const classifier: IntentClassifier = {
      classify: vi.fn().mockRejectedValue(classificationError),
    };

    const agent = createAgent({
      infrastructure,
      classifier,
      llm: createLLM(),
      clock: () => new Date(timestamp),
    });

    try {
      await expect(
        agent.execute({
          message: "Find TypeScript documentation.",
        }),
      ).rejects.toBe(classificationError);

      const conversations =
        infrastructure.database.prepare(
          "SELECT id FROM conversations",
        ).all() as Array<{ id: string }>;

      expect(conversations).toHaveLength(1);

      const messages =
        await infrastructure.memoryStore.conversations.getMessages(
          conversations[0].id,
        );

      expect(messages).toEqual([]);

      expect(classifier.classify).toHaveBeenCalledOnce();
    } finally {
      agent.close();
      infrastructure.close();
    }
  });

  it("wraps memory retrieval failures and does not persist the user message", async () => {
    const infrastructure = createInfrastructure();
    const memoryError = new Error("Memory database unavailable.");

    const memorySearch = vi.spyOn(
      infrastructure.memoryStore.search,
      "search",
    ).mockRejectedValue(memoryError);

    const agent = createAgent({
      infrastructure,
      classifier: createClassifier("RECALL"),
      llm: createLLM(),
      clock: () => new Date(timestamp),
    });

    try {
      await expect(
        agent.execute({
          message: "What do I remember about TypeScript?",
        }),
      ).rejects.toMatchObject({
        name: "MemoryRetrievalError",
        message: "Memory database unavailable.",
        cause: memoryError,
      });

      const conversations =
        infrastructure.database.prepare(
          "SELECT id FROM conversations",
        ).all() as Array<{ id: string }>;

      expect(conversations).toHaveLength(1);

      const messages =
        await infrastructure.memoryStore.conversations.getMessages(
          conversations[0].id,
        );

      expect(messages).toEqual([]);
      expect(memorySearch).toHaveBeenCalledOnce();
    } finally {
      agent.close();
      infrastructure.close();
    }
  });

  it("wraps research failures and preserves the user message without persisting a snapshot", async () => {
    const infrastructure = createInfrastructure();
    const searchError = new Error("Search provider unavailable.");

    const search = vi.spyOn(
      infrastructure.searchService,
      "search",
    ).mockRejectedValue(searchError);

    const agent = createAgent({
      infrastructure,
      classifier: createClassifier("RESEARCH"),
      llm: createLLM(),
      clock: () => new Date(timestamp),
    });

    try {
      await expect(
        agent.execute({
          message: "Find TypeScript documentation.",
        }),
      ).rejects.toMatchObject({
        name: "ResearchExecutionError",
        message: "Search provider unavailable.",
        cause: searchError,
      });

      const conversations =
        infrastructure.database.prepare(
          "SELECT id FROM conversations",
        ).all() as Array<{ id: string }>;

      expect(conversations).toHaveLength(1);

      const conversationId = conversations[0].id;

      const messages =
        await infrastructure.memoryStore.conversations.getMessages(
          conversationId,
        );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        role: "user",
        content: "Find TypeScript documentation.",
      });

      const snapshots =
        await infrastructure.memoryStore.researchSnapshots.findByConversation(
          conversationId,
        );

      expect(snapshots).toEqual([]);

      expect(search).toHaveBeenCalledOnce();
    } finally {
      agent.close();
      infrastructure.close();
    }
  });
  it("preserves the fresh snapshot but rolls back the verification bundle when comparison persistence fails", async () => {
    const infrastructure = createInfrastructure();

    const historical = {
      id: "historical-snapshot",
      query: "Find TypeScript documentation.",
      provider: "searxng",
      searchedAt: "2026-11-10T10:00:00.000Z",
      recordedAt: "2026-11-10T10:00:00.000Z",
      results: [
        {
          title: "TypeScript Documentation",
          url: "https://example.com/typescript",
          snippet: "Historical TypeScript documentation.",
          source: "test-engine",
        },
      ],
    };

    await infrastructure.memoryStore.conversations.create({
      id: "verification-conversation",
      title: "Historical research",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await infrastructure.memoryStore.researchSnapshots.save({
      ...historical,
      conversationId: "verification-conversation",
    });

    vi.spyOn(
      infrastructure.searchService,
      "search",
    ).mockResolvedValue({
      query: historical.query,
      provider: "searxng",
      searchedAt: timestamp,
      results: [
        {
          title: "TypeScript Documentation",
          url: "https://example.com/typescript",
          snippet: "Updated TypeScript documentation.",
          source: "test-engine",
        },
      ],
    });

    infrastructure.database.exec(`
    CREATE TRIGGER fail_comparison_insert
    BEFORE INSERT ON comparison_results
    BEGIN
      SELECT RAISE(ABORT, 'Comparison database write failed.');
    END;
  `);

    const agent = createAgent({
      infrastructure,
      clock: () => new Date(timestamp),
    });

    try {
      await expect(
        agent.verify({
          historicalSnapshotId: historical.id,
          conversationId: "verification-conversation",
        }),
      ).rejects.toMatchObject({
        name: "AgentPersistenceError",
        operation: "save_verification_bundle",
      });

      const snapshots =
        await infrastructure.memoryStore.researchSnapshots.findByConversation(
          "verification-conversation",
        );

      expect(snapshots).toHaveLength(2);

      const comparisons =
        await infrastructure.verificationRepository.findComparisonResults(
          historical.id,
          snapshots[1].id,
        );

      expect(comparisons).toEqual([]);

      const verifications =
        await infrastructure.verificationRepository.findVerificationResult(
          "nonexistent-verification",
        );

      expect(verifications).toBeNull();
    } finally {
      agent.close();
      infrastructure.close();
    }
  });

  it("preserves the fresh snapshot but rolls back comparisons when verification persistence fails", async () => {
    const infrastructure = createInfrastructure();

    const historical = {
      id: "historical-snapshot",
      query: "Find TypeScript documentation.",
      provider: "searxng",
      searchedAt: "2026-11-10T10:00:00.000Z",
      recordedAt: "2026-11-10T10:00:00.000Z",
      results: [
        {
          title: "TypeScript Documentation",
          url: "https://example.com/typescript",
          snippet: "Historical TypeScript documentation.",
          source: "test-engine",
        },
      ],
    };

    await infrastructure.memoryStore.conversations.create({
      id: "verification-conversation",
      title: "Historical research",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await infrastructure.memoryStore.researchSnapshots.save({
      ...historical,
      conversationId: "verification-conversation",
    });

    vi.spyOn(
      infrastructure.searchService,
      "search",
    ).mockResolvedValue({
      query: historical.query,
      provider: "searxng",
      searchedAt: timestamp,
      results: [
        {
          title: "TypeScript Documentation",
          url: "https://example.com/typescript",
          snippet: "Updated TypeScript documentation.",
          source: "test-engine",
        },
      ],
    });

    infrastructure.database.exec(`
    CREATE TRIGGER fail_verification_insert
    BEFORE INSERT ON verification_results
    BEGIN
      SELECT RAISE(ABORT, 'Verification database write failed.');
    END;
  `);

    const agent = createAgent({
      infrastructure,
      clock: () => new Date(timestamp),
    });

    try {
      await expect(
        agent.verify({
          historicalSnapshotId: historical.id,
          conversationId: "verification-conversation",
        }),
      ).rejects.toMatchObject({
        name: "AgentPersistenceError",
        operation: "save_verification_bundle",
      });

      const snapshots =
        await infrastructure.memoryStore.researchSnapshots.findByConversation(
          "verification-conversation",
        );

      expect(snapshots).toHaveLength(2);

      const comparisons =
        await infrastructure.verificationRepository.findComparisonResults(
          historical.id,
          snapshots[1].id,
        );

      // Comparisons must roll back because they were part of
      // the same transaction as the failed verification insert.
      expect(comparisons).toEqual([]);

      const verifications =
        await infrastructure.verificationRepository.findVerificationResult(
          "nonexistent-verification",
        );

      expect(verifications).toBeNull();
    } finally {
      agent.close();
      infrastructure.close();
    }
  });
});