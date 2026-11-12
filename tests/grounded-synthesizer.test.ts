import { describe, expect, it, vi } from "vitest";

import {
  GroundedSynthesizer,
  GroundedSynthesisError,
  InvalidSynthesisError,
} from "../src/agent/grounded-synthesizer.js";

import type { LLMProvider } from "../src/llm/llm-provider.js";

import type {
  SynthesisRequest,
  AgentResponse,
} from "../src/agent/orchestration-types.js";

const fixedDate = "2026-11-11T10:00:00.000Z";

const request: SynthesisRequest = {
  question: "What does the project do?",
  intent: "RESEARCH",
  evidence: {
    collectedAt: fixedDate,
    items: [
      {
        id: "research_result:https://example.com/docs",
        sourceType: "research_result",
        sourceId: "https://example.com/docs",
        content: "The project is a conversational research agent.",
        createdAt: fixedDate,
        title: "Project Documentation",
        sourceUrl: "https://example.com/docs",
      },
      {
        id: "memory_record:memory-1",
        sourceType: "memory_record",
        sourceId: "memory-1",
        content: "The project uses TypeScript.",
        createdAt: fixedDate,
      },
    ],
  },
};

const validResponse: AgentResponse = {
  answer:
    "The project is a conversational research agent built using TypeScript.",
  intent: "RESEARCH",
  status: "supported",
  citations: [
    {
      evidenceId: "research_result:https://example.com/docs",
    },
    {
      evidenceId: "memory_record:memory-1",
    },
  ],
  generatedAt: fixedDate,
};

function createLLM(response: unknown = validResponse) {
  return {
    generateStructured: vi.fn().mockResolvedValue(response),
  } satisfies LLMProvider;
}

describe("GroundedSynthesizer", () => {
  it("generates a grounded response", async () => {
    const llm = createLLM();
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    const result = await synthesizer.synthesize(request);

    expect(result).toEqual(validResponse);
    expect(llm.generateStructured).toHaveBeenCalledOnce();
  });

  it("sends the system and user messages to the LLM", async () => {
    const llm = createLLM();
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await synthesizer.synthesize(request);

    const generationRequest = llm.generateStructured.mock.calls[0][0];

    expect(generationRequest.messages).toHaveLength(2);
    expect(generationRequest.messages[0].role).toBe("system");
    expect(generationRequest.messages[1].role).toBe("user");
  });

  it("includes the question and intent in the prompt", async () => {
    const llm = createLLM();
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await synthesizer.synthesize(request);

    const generationRequest = llm.generateStructured.mock.calls[0][0];
    const prompt = generationRequest.messages[1].content;

    expect(prompt).toContain(request.question);
    expect(prompt).toContain(request.intent);
  });

  it("includes evidence IDs and provenance in the prompt", async () => {
    const llm = createLLM();
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await synthesizer.synthesize(request);

    const generationRequest = llm.generateStructured.mock.calls[0][0];
    const prompt = generationRequest.messages[1].content;

    expect(prompt).toContain(
      "research_result:https://example.com/docs",
    );
    expect(prompt).toContain("https://example.com/docs");
    expect(prompt).toContain("Project Documentation");
    expect(prompt).toContain("memory_record:memory-1");
  });

  it("requests deterministic structured generation", async () => {
    const llm = createLLM();
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await synthesizer.synthesize(request);

    const generationRequest = llm.generateStructured.mock.calls[0][0];

    expect(generationRequest.temperature).toBe(0);
    expect(generationRequest.think).toBe(false);
    expect(generationRequest.format).toEqual(
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
      }),
    );
  });

  it("uses the injected clock for the generation timestamp", async () => {
    const llm = createLLM();
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await synthesizer.synthesize(request);

    const generationRequest = llm.generateStructured.mock.calls[0][0];

    expect(generationRequest.messages[1].content).toContain(fixedDate);
  });

  it("accepts a partially supported response", async () => {
    const partialResponse: AgentResponse = {
      ...validResponse,
      status: "partially_supported",
      citations: [validResponse.citations[0]],
    };

    const llm = createLLM(partialResponse);
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    const result = await synthesizer.synthesize(request);

    expect(result.status).toBe("partially_supported");
  });

  it("accepts insufficient evidence without citations", async () => {
    const insufficientResponse: AgentResponse = {
      answer: "There is insufficient evidence to answer this question.",
      intent: "RESEARCH",
      status: "insufficient_evidence",
      citations: [],
      generatedAt: fixedDate,
    };

    const llm = createLLM(insufficientResponse);
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    const result = await synthesizer.synthesize(request);

    expect(result.status).toBe("insufficient_evidence");
    expect(result.citations).toEqual([]);
  });

  it("rejects an invalid synthesis request", async () => {
    const llm = createLLM();
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    const invalidRequest = {
      ...request,
      question: "   ",
    } as SynthesisRequest;

    await expect(
      synthesizer.synthesize(invalidRequest),
    ).rejects.toBeInstanceOf(InvalidSynthesisError);

    expect(llm.generateStructured).not.toHaveBeenCalled();
  });

  it("wraps LLM provider failures", async () => {
    const llm = createLLM();
    llm.generateStructured.mockRejectedValue(
      new Error("Provider unavailable."),
    );

    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await expect(
      synthesizer.synthesize(request),
    ).rejects.toBeInstanceOf(GroundedSynthesisError);
  });

  it("wraps non-Error provider failures", async () => {
    const llm = createLLM();
    llm.generateStructured.mockRejectedValue("Provider failed.");

    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await expect(
      synthesizer.synthesize(request),
    ).rejects.toThrow("LLM synthesis failed.");
  });

  it("rejects malformed LLM output", async () => {
    const llm = createLLM({
      answer: "Some answer",
      intent: "RESEARCH",
    });

    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await expect(
      synthesizer.synthesize(request),
    ).rejects.toBeInstanceOf(InvalidSynthesisError);
  });

  it("rejects citations referencing unknown evidence IDs", async () => {
    const fabricatedResponse: AgentResponse = {
      ...validResponse,
      citations: [
        {
          evidenceId: "fabricated-evidence-id",
        },
      ],
    };

    const llm = createLLM(fabricatedResponse);
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await expect(
      synthesizer.synthesize(request),
    ).rejects.toThrow(
      "LLM returned citations that do not match supplied evidence.",
    );
  });

  it("rejects a response with a different intent", async () => {
    const wrongIntentResponse: AgentResponse = {
      ...validResponse,
      intent: "RECALL",
    };

    const llm = createLLM(wrongIntentResponse);
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await expect(
      synthesizer.synthesize(request),
    ).rejects.toThrow(
      "LLM returned a different intent from the synthesis request.",
    );
  });

  it("rejects an unexpected generation timestamp", async () => {
    const wrongTimestampResponse: AgentResponse = {
      ...validResponse,
      generatedAt: "2026-11-10T10:00:00.000Z",
    };

    const llm = createLLM(wrongTimestampResponse);
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await expect(
      synthesizer.synthesize(request),
    ).rejects.toThrow(
      "LLM returned an unexpected generation timestamp.",
    );
  });

  it("rejects insufficient evidence responses containing citations", async () => {
    const invalidResponse = {
      answer: "There is insufficient evidence.",
      intent: "RESEARCH",
      status: "insufficient_evidence",
      citations: [
        {
          evidenceId: "memory_record:memory-1",
        },
      ],
      generatedAt: fixedDate,
    };

    const llm = createLLM(invalidResponse);
    const synthesizer = new GroundedSynthesizer(
      llm,
      () => new Date(fixedDate),
    );

    await expect(
      synthesizer.synthesize(request),
    ).rejects.toBeInstanceOf(InvalidSynthesisError);
  });
});