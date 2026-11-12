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

import type { AgentInfrastructure } from "../src/agent/create-agent-infrastructure.js";

import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgent } from "../src/agent/create-agent.js";

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

        const agent = createAgent({
            classifier: createClassifier(intent),
            llm,
            clock: () => new Date(timestamp),
            infrastructureConfig: {
                databasePath: join(
                    createTestDirectory(),
                    "data",
                    "minimi-agent.db",
                ),
                searxngBaseUrl: "http://localhost:8080",
                searchFetch,
            },
        });

        return {
            agent,
            llm,
            searchFetch,
        };
    }

    it("executes a research request through the full pipeline", async () => {
        const { agent, llm, searchFetch } =
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
            });

            expect(searchFetch).toHaveBeenCalledOnce();
            expect(llm.generateStructured).toHaveBeenCalledOnce();
        } finally {
            agent.close();
        }
    });

    it("does not execute research for a recall request", async () => {
        const { agent, searchFetch } =
            createTestAgent("RECALL");

        try {
            const response = await agent.execute({
                message: "What do I remember about TypeScript?",
            });

            expect(response.intent).toBe("RECALL");
            expect(searchFetch).not.toHaveBeenCalled();
        } finally {
            agent.close();
        }
    });

    it("executes both memory retrieval and research for verification", async () => {
        const { agent, searchFetch } =
            createTestAgent("VERIFY");

        try {
            const response = await agent.execute({
                message: "Verify this information about TypeScript.",
            });

            expect(response.intent).toBe("VERIFY");
            expect(searchFetch).toHaveBeenCalledOnce();
        } finally {
            agent.close();
        }
    });

    it("executes both memory retrieval and research for comparison", async () => {
        const { agent, searchFetch } =
            createTestAgent("COMPARE");

        try {
            const response = await agent.execute({
                message: "Compare the available TypeScript information.",
            });

            expect(response.intent).toBe("COMPARE");
            expect(searchFetch).toHaveBeenCalledOnce();
        } finally {
            agent.close();
        }
    });

    it("rejects an invalid execution request before classification", async () => {
        const { agent, searchFetch } =
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
            agent.close();
        }
    });

    it("preserves the existing plan method", async () => {
        const { agent } = createTestAgent("RESEARCH");

        try {
            await expect(
                agent.plan("Find TypeScript documentation."),
            ).resolves.toEqual({
                intent: "RESEARCH",
                requiresMemory: false,
                requiresSearch: true,
            });
        } finally {
            agent.close();
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
});