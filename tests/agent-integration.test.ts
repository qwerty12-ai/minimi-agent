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

describe("Agent Integration", () => {
  let directory: string | undefined;

  const generationTime = "2026-11-12T10:00:00.000Z";

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();

    if (directory) {
      rmSync(directory, {
        recursive: true,
        force: true,
      });

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
          const payload = JSON.parse(
            String(init?.body ?? "{}"),
          );

          const systemMessage = payload.messages?.[0]?.content ?? "";

          const content = systemMessage.includes("intent")
            ? {
                intent: "RESEARCH",
              }
            : {
                answer: "TypeScript is a strongly typed programming language.",
                intent: "RESEARCH",
                status: "supported",
                citations: [],
                generatedAt: generationTime,
              };

          return new Response(
            JSON.stringify({
              message: {
                content: JSON.stringify(content),
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  }

  it("executes the complete research pipeline and persists its conversation", async () => {
    mockFetch();

    const databasePath = join(
      createTestDirectory(),
      "data",
      "minimi-agent.db",
    );

    vi.stubEnv(
      "OLLAMA_BASE_URL",
      "http://localhost:11434",
    );

    vi.stubEnv(
      "OLLAMA_MODEL",
      "qwen3.5:2b",
    );

    const infrastructure = createAgentInfrastructure({
      databasePath,
      searxngBaseUrl: "http://localhost:8080",
      searchFetch: vi.fn(async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                title: "TypeScript Documentation",
                url: "https://www.typescriptlang.org/",
                content: "Official TypeScript documentation.",
                engine: "test-engine",
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
});