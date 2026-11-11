import type { LLMProvider } from "../llm/llm-provider.js";
import type {
  SynthesisRequest,
  AgentResponse,
} from "./orchestration-types.js";

import {
  parseAgentResponse,
  parseSynthesisRequest,
  validateAgentResponseCitations,
} from "./orchestration-schema.js";

const SYNTHESIS_FORMAT_SCHEMA = {
  type: "object",
  properties: {
    answer: {
      type: "string",
    },
    intent: {
      type: "string",
      enum: ["RECALL", "RESEARCH", "VERIFY", "COMPARE"],
    },
    status: {
      type: "string",
      enum: [
        "supported",
        "partially_supported",
        "insufficient_evidence",
      ],
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          evidenceId: {
            type: "string",
          },
        },
        required: ["evidenceId"],
        additionalProperties: false,
      },
    },
    generatedAt: {
      type: "string",
    },
  },
  required: [
    "answer",
    "intent",
    "status",
    "citations",
    "generatedAt",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `
You are the grounded synthesis engine of a conversational research agent.

Your task is to answer the user's question using only the supplied evidence.

STRICT RULES:

1. Use only information contained in the supplied evidence.
2. Never invent facts, sources, URLs, quotations, or evidence IDs.
3. Every factual claim must be supported by supplied evidence.
4. Cite evidence using its exact evidence ID.
5. Never cite an evidence ID that was not supplied.
6. If evidence supports only part of the answer, use partially_supported.
7. If evidence is insufficient to answer, use insufficient_evidence.
8. An insufficient_evidence response must contain zero citations.
9. Do not treat missing information as proof of a claim.
10. Do not claim that research was performed unless research evidence was supplied.
11. Keep the answer clear and directly relevant to the question.

Return exactly one JSON object matching the requested schema.
Do not include markdown fences or additional text.
`;

export class GroundedSynthesisError extends Error {
  readonly stage = "synthesis" as const;
  readonly code = "SYNTHESIS_FAILED" as const;
  readonly retryable = true;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GroundedSynthesisError";
  }
}

export class InvalidSynthesisError extends Error {
  readonly stage = "synthesis" as const;
  readonly code = "INVALID_SYNTHESIS" as const;
  readonly retryable = false;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidSynthesisError";
  }
}

export class GroundedSynthesizer {
  constructor(
    private readonly llm: LLMProvider,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async synthesize(
    request: SynthesisRequest,
  ): Promise<AgentResponse> {
    let validatedRequest: SynthesisRequest;

    try {
      parseSynthesisRequest(request);
      validatedRequest = request;
    } catch (error) {
      throw new InvalidSynthesisError(
        "Synthesis request is invalid.",
        { cause: error },
      );
    }

    const generationTime = this.clock().toISOString();

    const evidencePayload = validatedRequest.evidence.items.map(
      (item) => ({
        evidenceId: item.id,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        content: item.content,
        createdAt: item.createdAt,
        title: item.title ?? null,
        sourceUrl: item.sourceUrl ?? null,
      }),
    );

    const userPrompt = `
Question:
${validatedRequest.question}

Intent:
${validatedRequest.intent}

Evidence:
${JSON.stringify(evidencePayload, null, 2)}

Current generation timestamp:
${generationTime}

Produce a grounded answer using only this evidence.
`;

    let rawResponse: unknown;

    try {
      rawResponse = await this.llm.generateStructured({
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        format: SYNTHESIS_FORMAT_SCHEMA,
        temperature: 0,
        think: false,
      });
    } catch (error) {
      throw new GroundedSynthesisError(
        error instanceof Error
          ? error.message
          : "LLM synthesis failed.",
        { cause: error },
      );
    }

    let response: AgentResponse;

    try {
      response = parseAgentResponse(rawResponse);
    } catch (error) {
      throw new InvalidSynthesisError(
        "LLM returned an invalid synthesis response.",
        { cause: error },
      );
    }

    if (response.intent !== validatedRequest.intent) {
      throw new InvalidSynthesisError(
        "LLM returned a different intent from the synthesis request.",
      );
    }

    try {
      validateAgentResponseCitations(
        response,
        validatedRequest.evidence,
      );
    } catch (error) {
      throw new InvalidSynthesisError(
        "LLM returned citations that do not match supplied evidence.",
        { cause: error },
      );
    }

    if (response.generatedAt !== generationTime) {
      throw new InvalidSynthesisError(
        "LLM returned an unexpected generation timestamp.",
      );
    }

    return response;
  }
}