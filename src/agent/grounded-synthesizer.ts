import { z } from "zod";

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

const INSUFFICIENT_EVIDENCE_ANSWER =
  "I couldn't find enough reliable information to answer this question confidently. Try narrowing your question or using more specific search terms.";

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
  },
  required: [
    "answer",
    "intent",
    "status",
    "citations",
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
7. If evidence is insufficient to answer the user's question,
   use insufficient_evidence.
8. An insufficient_evidence response must contain zero citations.
9. Do not treat missing information as proof of a claim.
10. Do not claim that research was performed unless research evidence was supplied.
11. Keep the answer clear and directly relevant to the question.
12. The answer, status, and citations must agree with each other.
13. If the status is insufficient_evidence, provide a short,
    natural-language explanation that tells the user the evidence
    was inadequate. Never return a status name, enum value,
    placeholder, or machine-readable label as the answer.
14. Do not label an answer insufficient if supplied evidence
    directly and adequately answers the question.

Return exactly one JSON object matching the requested schema.
Do not include markdown fences or additional text.
`;

const RECOVERY_SYSTEM_PROMPT = `
You are a grounded synthesis engine performing a single evidence sufficiency reassessment.

A previous synthesis classified the answer as insufficient_evidence,
but its answer may contain substantive information.

Reassess the question using ONLY the evidence supplied in this request.

STRICT RULES:

1. Do not assume the previous answer is correct.
2. Do not assume the previous insufficient-evidence classification is correct.
3. Examine the supplied evidence directly against the question.
4. If the evidence directly answers the question, provide a supported answer
   and cite the exact evidence IDs that support it.
5. If evidence supports only part of the question, use partially_supported.
6. If the evidence genuinely cannot answer the question, use insufficient_evidence
   and provide zero citations.
7. Do not invent facts, citations, evidence IDs, sources, or URLs.
8. A supported or partially_supported response must have citations.
9. An insufficient_evidence response must have zero citations.
10. Do not make claims beyond the supplied evidence.
11. Treat the previous answer as a candidate for reassessment, not as evidence.
12. Return exactly one JSON object matching the requested schema.
13. Do not include markdown fences or additional text.
`;

const DIAGNOSTICS_ENABLED =
  process.env.MINIMI_SYNTHESIS_DIAGNOSTICS === "1";

const MAX_DIAGNOSTIC_OUTPUT_LENGTH = 6000;
const MAX_EVIDENCE_PREVIEW_LENGTH = 500;

function diagnosticLog(
  label: string,
  value: unknown,
): void {
  if (!DIAGNOSTICS_ENABLED) {
    return;
  }

  let serialized: string;

  try {
    serialized = JSON.stringify(value, null, 2);
  } catch {
    serialized = "[Unable to serialize diagnostic output]";
  }

  if (serialized.length > MAX_DIAGNOSTIC_OUTPUT_LENGTH) {
    serialized =
      serialized.slice(0, MAX_DIAGNOSTIC_OUTPUT_LENGTH) +
      "\n...[diagnostic output truncated]";
  }

  console.log(`[MiniMi Synthesis Diagnostics] ${label}`);
  console.log(serialized);
}

function describeValidationError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0
          ? issue.path.join(".")
          : "<root>";

        return `${path}: ${issue.message}`;
      })
      .join("; ");
  }

  return error instanceof Error
    ? error.message
    : "Unknown validation error.";
}

/**
 * Detect a substantive answer that the model simultaneously labels
 * insufficient_evidence.
 *
 * This intentionally does not trigger for short, ordinary insufficiency
 * explanations. It is only a signal to perform a bounded reassessment,
 * never a signal that the answer is correct or supported.
 */
function warrantsSufficiencyReassessment(
  rawResponse: unknown,
): boolean {
  if (
    typeof rawResponse !== "object" ||
    rawResponse === null ||
    Array.isArray(rawResponse)
  ) {
    return false;
  }

  const candidate = rawResponse as Record<string, unknown>;

  if (candidate.status !== "insufficient_evidence") {
    return false;
  }

  if (typeof candidate.answer !== "string") {
    return false;
  }

  const answer = candidate.answer.trim();

  if (answer.length === 0) {
    return false;
  }

  const ordinaryInsufficiencyPatterns = [
    /^insufficient[_\s-]*evidence$/i,
    /couldn't find enough/i,
    /could not find enough/i,
    /not enough (reliable )?information/i,
    /insufficient (information|evidence)/i,
    /insufficient to (establish|determine|answer|verify|confirm)/i,
    /unable to answer/i,
    /cannot answer confidently/i,
    /can't answer confidently/i,
    /not able to answer/i,
    /insufficient.*reliable answer/i,
  ];

  if (
    ordinaryInsufficiencyPatterns.some(
      (pattern) => pattern.test(answer),
    )
  ) {
    return false;
  }

  return true;
}

function normalizeResponsePayload(
  rawResponse: unknown,
  intent: SynthesisRequest["intent"],
  generatedAt: string,
): unknown {
  if (
    typeof rawResponse !== "object" ||
    rawResponse === null ||
    Array.isArray(rawResponse)
  ) {
    return rawResponse;
  }

  const candidate = rawResponse as Record<string, unknown>;

  return {
    ...candidate,
    intent,
    generatedAt,
    ...(candidate.status === "insufficient_evidence"
      ? {
        answer: INSUFFICIENT_EVIDENCE_ANSWER,
        citations: [],
      }
      : {}),
  };
}

function createSafeInsufficientResponse(
  intent: SynthesisRequest["intent"],
  generatedAt: string,
): AgentResponse {
  return parseAgentResponse({
    answer: INSUFFICIENT_EVIDENCE_ANSWER,
    intent,
    status: "insufficient_evidence",
    citations: [],
    generatedAt,
  });
}

function validateSynthesizedResponse(
  rawResponse: unknown,
  request: SynthesisRequest,
  generatedAt: string,
): AgentResponse {
  const normalizedPayload = normalizeResponsePayload(
    rawResponse,
    request.intent,
    generatedAt,
  );

  const response = parseAgentResponse(normalizedPayload);

  validateAgentResponseCitations(
    response,
    request.evidence,
  );

  return response;
}

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
  ) { }

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

    diagnosticLog("Synthesis request", {
      question: validatedRequest.question,
      intent: validatedRequest.intent,
      evidenceCount: evidencePayload.length,
      evidence: evidencePayload.map((item) => ({
        evidenceId: item.evidenceId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        title: item.title,
        sourceUrl: item.sourceUrl,
        contentLength: item.content.length,
        contentPreview: item.content.slice(
          0,
          MAX_EVIDENCE_PREVIEW_LENGTH,
        ),
      })),
    });

    const userPrompt = `
Question:
${validatedRequest.question}

Intent:
${validatedRequest.intent}

Evidence:
${JSON.stringify(evidencePayload, null, 2)}

Produce a grounded answer using only this evidence.
Ensure your answer, status, and citations are consistent.
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
      diagnosticLog("LLM generation failure", {
        error: error instanceof Error
          ? error.message
          : String(error),
      });

      throw new GroundedSynthesisError(
        error instanceof Error
          ? error.message
          : "LLM synthesis failed.",
        { cause: error },
      );
    }

    diagnosticLog("Raw LLM structured response", rawResponse);

    // Perform one targeted reassessment only when the model has
    // produced a substantive answer while declaring evidence insufficient.
    if (warrantsSufficiencyReassessment(rawResponse)) {
      diagnosticLog("Sufficiency reassessment triggered", {
        question: validatedRequest.question,
        previousAnswer:
          (rawResponse as Record<string, unknown>).answer,
        evidenceCount: evidencePayload.length,
      });

      const recoveryPrompt = `
Question:
${validatedRequest.question}

Intent:
${validatedRequest.intent}

Evidence:
${JSON.stringify(evidencePayload, null, 2)}

Previous candidate answer:
${String(
        (rawResponse as Record<string, unknown>).answer,
      )}

The previous synthesis supplied a substantive candidate answer but classified
the response as insufficient_evidence.

Reassess that classification against the evidence above.

Do not merely repeat the previous answer.
Do not assume it is correct.
Do not assume the evidence is insufficient.

If the evidence directly supports an answer, return supported or
partially_supported and cite the exact evidence IDs.

If it genuinely does not, return insufficient_evidence with zero citations.
`;

      try {
        const recoveryRawResponse =
          await this.llm.generateStructured({
            messages: [
              {
                role: "system",
                content: RECOVERY_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: recoveryPrompt,
              },
            ],
            format: SYNTHESIS_FORMAT_SCHEMA,
            temperature: 0,
            think: false,
          });

        diagnosticLog(
          "Sufficiency reassessment raw response",
          recoveryRawResponse,
        );

        try {
          const recoveredResponse =
            validateSynthesizedResponse(
              recoveryRawResponse,
              validatedRequest,
              generationTime,
            );

          diagnosticLog("Sufficiency reassessment validated", {
            status: recoveredResponse.status,
            citationCount: recoveredResponse.citations.length,
            citations: recoveredResponse.citations,
          });

          return recoveredResponse;
        } catch (error) {
          diagnosticLog(
            "Sufficiency reassessment validation failure",
            {
              error: describeValidationError(error),
              recoveryRawResponse,
            },
          );

          // A failed reassessment must not weaken the original contract.
          return createSafeInsufficientResponse(
            validatedRequest.intent,
            generationTime,
          );
        }
      } catch (error) {
        diagnosticLog("Sufficiency reassessment generation failure", {
          error: error instanceof Error
            ? error.message
            : String(error),
        });

        // Recovery is deliberately best-effort. Preserve safe behavior.
        return createSafeInsufficientResponse(
          validatedRequest.intent,
          generationTime,
        );
      }
    }

    let response: AgentResponse;

    try {
      response = validateSynthesizedResponse(
        rawResponse,
        validatedRequest,
        generationTime,
      );
    } catch (error) {
      const details = describeValidationError(error);

      diagnosticLog("Response validation failure", {
        details,
        rawResponse,
      });

      if (error instanceof z.ZodError) {
        throw new InvalidSynthesisError(
          `LLM returned an invalid synthesis response: ${details}`,
          { cause: error },
        );
      }

      throw new InvalidSynthesisError(
        "LLM returned citations that do not match supplied evidence.",
        { cause: error },
      );
    }

    diagnosticLog("Validated synthesis response", {
      answer: response.answer,
      intent: response.intent,
      status: response.status,
      citationCount: response.citations.length,
      citations: response.citations,
    });

    return response;
  }
}