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

import {
    createAgentInfrastructure,
    type AgentInfrastructure,
} from "../src/agent/create-agent-infrastructure.js";

import {
    createAgent,
    AgentPersistenceError,
} from "../src/agent/create-agent.js";

import type { IntentClassifier } from "../src/agent/types.js";
import type { LLMProvider } from "../src/llm/llm-provider.js";

const timestamp = "2026-11-12T10:00:00.000Z";

describe("Agent execution pipeline", () => {
    let directory: string | undefined;

    afterEach(() => {
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
            join(tmpdir(), "minimi-agent-execution-"),
        );

        return directory;
    }

    function createClassifier(intent: string): IntentClassifier {
        return {
            classify: vi.fn().mockResolvedValue({
                intent,
            }),
        } as unknown as IntentClassifier;
    }

    function createLLM(intent: string): LLMProvider {
        return {
            generateStructured: vi.fn().mockResolvedValue({
                answer: "The available evidence is insufficient to establish a reliable answer.",
                intent,
                status: "insufficient_evidence",
                citations: [],
                generatedAt: timestamp,
            }),
        };
    }

    function createSearchFetch() {
        return vi.fn(async () => {
            return new Response(
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
            );
        }) as unknown as typeof fetch;
    }

    function createTestAgent(intent: string) {
        const searchFetch = createSearchFetch();
        const llm = createLLM(intent);

        const infrastructure = createAgentInfrastructure({
            databasePath: join(
                createTestDirectory(),
                "data",
                "minimi-agent.db",
            ),
            searxngBaseUrl: "http://localhost:8080",
            searchFetch,
        });

        const agent = createAgent({
            classifier: createClassifier(intent),
            llm,
            clock: () => new Date(timestamp),
            infrastructure,
        });

        return {
            agent,
            llm,
            searchFetch,
            infrastructure,
        };
    }

    function closeTestAgent(
        agent: ReturnType<typeof createAgent>,
        infrastructure: AgentInfrastructure,
    ) {
        agent.close();
        infrastructure.close();
    }

    it("executes a research request through the full pipeline", async () => {
        const { agent, llm, searchFetch, infrastructure } =
            createTestAgent("RESEARCH");

        try {
            const response = await agent.execute({
                message: "Find TypeScript documentation.",
            });

            expect(response).toEqual({
                answer: "The available evidence is insufficient to establish a reliable answer.",
                intent: "RESEARCH",
                status: "insufficient_evidence",
                citations: [],
                generatedAt: timestamp,
                conversationId: expect.any(String),
            });

            expect(searchFetch).toHaveBeenCalledOnce();
            expect(llm.generateStructured).toHaveBeenCalledOnce();
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("does not execute research for a recall request", async () => {
        const { agent, searchFetch, infrastructure } =
            createTestAgent("RECALL");

        try {
            const response = await agent.execute({
                message: "What do I remember about TypeScript?",
            });

            expect(response.intent).toBe("RECALL");
            expect(searchFetch).not.toHaveBeenCalled();
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("executes both memory retrieval and research for verification", async () => {
        const { agent, searchFetch, infrastructure } =
            createTestAgent("VERIFY");

        try {
            const response = await agent.execute({
                message: "Verify this information about TypeScript.",
            });

            expect(response.intent).toBe("VERIFY");
            expect(searchFetch).toHaveBeenCalledOnce();
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("executes both memory retrieval and research for comparison", async () => {
        const { agent, searchFetch, infrastructure } =
            createTestAgent("COMPARE");

        try {
            const response = await agent.execute({
                message: "Compare the available TypeScript information.",
            });

            expect(response.intent).toBe("COMPARE");
            expect(searchFetch).toHaveBeenCalledOnce();
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("rejects an invalid execution request before classification", async () => {
        const { agent, searchFetch, infrastructure } =
            createTestAgent("RESEARCH");

        try {
            await expect(
                agent.execute({
                    message: "   ",
                }),
            ).rejects.toThrow(
                "Agent execution request is invalid.",
            );

            expect(searchFetch).not.toHaveBeenCalled();
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("preserves the existing plan method", async () => {
        const { agent, infrastructure } =
            createTestAgent("RESEARCH");

        try {
            await expect(
                agent.plan("Find TypeScript documentation."),
            ).resolves.toEqual({
                intent: "RESEARCH",
                requiresMemory: false,
                requiresSearch: true,
            });
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("does not close externally supplied infrastructure", () => {
        const infrastructure = {
            memoryStore: {
                search: {
                    search: vi.fn().mockResolvedValue([]),
                },
            },
            searchService: {
                search: vi.fn(),
            },
            close: vi.fn(),
        } as unknown as AgentInfrastructure;

        const agent = createAgent({
            infrastructure,
            classifier: createClassifier("RESEARCH"),
            llm: createLLM("RESEARCH"),
        });

        agent.close();

        expect(infrastructure.close).not.toHaveBeenCalled();
    });

    it("creates a conversation and persists the user message", async () => {
        const { agent, infrastructure } =
            createTestAgent("RESEARCH");

        try {
            const response = await agent.execute({
                message: "Find TypeScript documentation.",
            });

            const conversation =
                await infrastructure.memoryStore.conversations.findById(
                    response.conversationId,
                );

            const messages =
                await infrastructure.memoryStore.conversations.getMessages(
                    response.conversationId,
                );

            expect(conversation).not.toBeNull();
            expect(conversation?.id).toBe(response.conversationId);
            expect(conversation?.title).toBe(
                "Find TypeScript documentation.",
            );

            expect(messages[0]).toMatchObject({
                conversationId: response.conversationId,
                role: "user",
                content: "Find TypeScript documentation.",
            });
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("persists the assistant response after successful synthesis", async () => {
        const { agent, infrastructure } =
            createTestAgent("RESEARCH");

        try {
            const response = await agent.execute({
                message: "Find TypeScript documentation.",
            });

            const messages =
                await infrastructure.memoryStore.conversations.getMessages(
                    response.conversationId,
                );

            expect(messages).toHaveLength(2);

            expect(messages[1]).toMatchObject({
                conversationId: response.conversationId,
                role: "assistant",
                content: response.answer,
                createdAt: response.generatedAt,
            });
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("reuses an existing conversation and appends messages", async () => {
        const { agent, infrastructure } =
            createTestAgent("RESEARCH");

        try {
            const firstResponse = await agent.execute({
                message: "Find TypeScript documentation.",
            });

            const secondResponse = await agent.execute({
                message: "Find more TypeScript information.",
                conversationId: firstResponse.conversationId,
            });

            expect(secondResponse.conversationId).toBe(
                firstResponse.conversationId,
            );

            const messages =
                await infrastructure.memoryStore.conversations.getMessages(
                    firstResponse.conversationId,
                );

            expect(messages).toHaveLength(4);

            expect(messages.map((message) => message.role)).toEqual([
                "user",
                "assistant",
                "user",
                "assistant",
            ]);
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("rejects an unknown conversation ID", async () => {
        const { agent, infrastructure } =
            createTestAgent("RESEARCH");

        try {
            await expect(
                agent.execute({
                    message: "Find TypeScript documentation.",
                    conversationId: "nonexistent-conversation",
                }),
            ).rejects.toThrow(
                "Conversation 'nonexistent-conversation' does not exist.",
            );
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("persists research snapshots against the conversation", async () => {
        const { agent, infrastructure } =
            createTestAgent("RESEARCH");

        try {
            const response = await agent.execute({
                message: "Find TypeScript documentation.",
            });

            const snapshots =
                await infrastructure.memoryStore.researchSnapshots.findByConversation(
                    response.conversationId,
                );

            expect(snapshots).toHaveLength(1);

            expect(snapshots[0]).toMatchObject({
                conversationId: response.conversationId,
                query: "Find TypeScript documentation.",
                provider: expect.any(String),
                results: expect.any(Array),
            });

            expect(snapshots[0].results.length).toBeGreaterThan(0);
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("does not persist an assistant message when synthesis fails", async () => {
        const { agent, llm, infrastructure } =
            createTestAgent("RESEARCH");

        vi.mocked(llm.generateStructured).mockRejectedValueOnce(
            new Error("Synthesis failed."),
        );

        try {
            await expect(
                agent.execute({
                    message: "Find TypeScript documentation.",
                }),
            ).rejects.toThrow();

            const conversations =
                infrastructure.database.prepare(
                    "SELECT id FROM conversations",
                ).all() as Array<{ id: string }>;

            expect(conversations).toHaveLength(1);

            const messages =
                await infrastructure.memoryStore.conversations.getMessages(
                    conversations[0].id,
                );

            expect(messages).toHaveLength(1);
            expect(messages[0].role).toBe("user");
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });

    it("surfaces conversation message persistence failures", async () => {
        const { agent, infrastructure } =
            createTestAgent("RESEARCH");

        vi.spyOn(
            infrastructure.memoryStore.conversations,
            "appendMessage",
        ).mockRejectedValueOnce(
            new Error("Database write failed."),
        );

        try {
            await expect(
                agent.execute({
                    message: "Find TypeScript documentation.",
                }),
            ).rejects.toThrow(AgentPersistenceError);
        } finally {
            closeTestAgent(agent, infrastructure);
        }
    });
});