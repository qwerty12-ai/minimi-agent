import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createAgent } from "../src/agent/create-agent.js";

function mockOllamaResponse(intent: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,

    json: async () => ({
      message: {
        content: JSON.stringify({
          intent,
        }),
      },
    }),
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("Agent Integration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("should classify a research request and create an execution plan", async () => {
    const fetchMock = mockOllamaResponse("RESEARCH");

    const agent = createAgent();

    const plan = await agent.plan(
      "Find the latest pricing of Neon."
    );

    expect(plan).toEqual({
      intent: "RESEARCH",
      requiresMemory: false,
      requiresSearch: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should classify a recall request and create an execution plan", async () => {
    const fetchMock = mockOllamaResponse("RECALL");

    const agent = createAgent();

    const plan = await agent.plan(
      "What did I ask you about PostgreSQL last week?"
    );

    expect(plan).toEqual({
      intent: "RECALL",
      requiresMemory: true,
      requiresSearch: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should classify a verification request correctly", async () => {
    mockOllamaResponse("VERIFY");

    const agent = createAgent();

    const plan = await agent.plan(
      "Is the pricing you showed me last Tuesday still accurate?"
    );

    expect(plan).toEqual({
      intent: "VERIFY",
      requiresMemory: true,
      requiresSearch: true,
    });
  });

  it("should classify a comparison request correctly", async () => {
    mockOllamaResponse("COMPARE");

    const agent = createAgent();

    const plan = await agent.plan(
      "Compare the CRM tools we shortlisted against their current features."
    );

    expect(plan).toEqual({
      intent: "COMPARE",
      requiresMemory: true,
      requiresSearch: true,
    });
  });

  it("should reject empty messages before calling Ollama", async () => {
    const fetchMock = mockOllamaResponse("RESEARCH");

    const agent = createAgent();

    await expect(
      agent.plan("   ")
    ).rejects.toThrow("Message must not be empty.");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});