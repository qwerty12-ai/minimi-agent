import { z } from "zod";
import { INTENTS } from "./types.js";
import { SearchResultSchema } from "../research/search-schema.js";

const IntentSchema = z.enum(INTENTS);

const MemorySearchResultSchema = z.object({
  sourceType: z.enum([
    "conversation_message",
    "memory_record",
  ]),
  sourceId: z.string().trim().min(1).max(200),
  content: z.string().max(100000),
  createdAt: z.string().datetime(),
  rank: z.number().finite(),
  kind: z.enum([
    "fact",
    "preference",
    "decision",
    "context",
  ]).optional(),
}).strict();

export const AgentExecutionRequestSchema = z.object({
  message: z.string().trim().min(1).max(100000),
  conversationId: z.string().trim().min(1).max(200).optional(),
}).strict();

export const MemoryContextSchema = z.object({
  query: z.string().trim().min(1).max(500),
  retrievedAt: z.string().datetime(),
  results: z.array(MemorySearchResultSchema).max(50),
}).strict();

export const ResearchContextSchema = z.object({
  query: z.string().trim().min(1).max(500),
  provider: z.string().trim().min(1).max(200),
  searchedAt: z.string().datetime(),
  results: z.array(SearchResultSchema).max(100),
}).strict();

export const EvidenceSourceTypeSchema = z.enum([
  "conversation_message",
  "memory_record",
  "research_result",
]);

export const EvidenceItemSchema = z.object({
  id: z.string().trim().min(1).max(200),
  sourceType: EvidenceSourceTypeSchema,
  sourceId: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(100000),
  createdAt: z.string().datetime(),
  title: z.string().trim().min(1).max(500).optional(),
  sourceUrl: z.string().url().optional(),
}).strict();

export const EvidencePackageSchema = z.object({
  collectedAt: z.string().datetime(),
  items: z.array(EvidenceItemSchema).max(500),
}).strict().superRefine((value, context) => {
  const ids = new Set<string>();

  value.items.forEach((item, index) => {
    if (ids.has(item.id)) {
      context.addIssue({
        code: "custom",
        path: ["items", index, "id"],
        message: "Evidence IDs must be unique.",
      });
    }

    ids.add(item.id);
  });
});

export const SynthesisRequestSchema = z.object({
  question: z.string().trim().min(1).max(100000),
  intent: IntentSchema,
  evidence: EvidencePackageSchema,
}).strict();

export const SynthesisStatusSchema = z.enum([
  "supported",
  "partially_supported",
  "insufficient_evidence",
]);

export const EvidenceCitationSchema = z.object({
  evidenceId: z.string().trim().min(1).max(200),
}).strict();

export const AgentResponseSchema = z.object({
  answer: z.string().trim().min(1).max(100000),
  intent: IntentSchema,
  status: SynthesisStatusSchema,
  citations: z.array(EvidenceCitationSchema).max(500),
  generatedAt: z.string().datetime(),
}).strict().superRefine((response, context) => {
  const ids = new Set<string>();

  response.citations.forEach((citation, index) => {
    if (ids.has(citation.evidenceId)) {
      context.addIssue({
        code: "custom",
        path: ["citations", index, "evidenceId"],
        message: "Citation IDs must be unique.",
      });
    }

    ids.add(citation.evidenceId);
  });

  if (
    response.status === "insufficient_evidence" &&
    response.citations.length > 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["citations"],
      message: "An insufficient-evidence response must not cite evidence.",
    });
  }
});

export const ExecutionStageSchema = z.enum([
  "classification",
  "memory",
  "research",
  "evidence",
  "synthesis",
]);

export const AgentExecutionErrorCodeSchema = z.enum([
  "CLASSIFICATION_FAILED",
  "MEMORY_RETRIEVAL_FAILED",
  "RESEARCH_FAILED",
  "EVIDENCE_ASSEMBLY_FAILED",
  "SYNTHESIS_FAILED",
  "INVALID_SYNTHESIS",
]);

export const AgentExecutionErrorSchema = z.object({
  stage: ExecutionStageSchema,
  code: AgentExecutionErrorCodeSchema,
  message: z.string().trim().min(1).max(5000),
  retryable: z.boolean(),
}).strict();

// Parse and validate the domain contracts.
export function parseAgentExecutionRequest(value: unknown) {
  return AgentExecutionRequestSchema.parse(value);
}

export function parseMemoryContext(value: unknown) {
  return MemoryContextSchema.parse(value);
}

export function parseResearchContext(value: unknown) {
  return ResearchContextSchema.parse(value);
}

export function parseEvidenceItem(value: unknown) {
  return EvidenceItemSchema.parse(value);
}

export function parseEvidencePackage(value: unknown) {
  return EvidencePackageSchema.parse(value);
}

export function parseSynthesisRequest(value: unknown) {
  return SynthesisRequestSchema.parse(value);
}

export function parseAgentResponse(value: unknown) {
  return AgentResponseSchema.parse(value);
}

export function parseAgentExecutionError(value: unknown) {
  return AgentExecutionErrorSchema.parse(value);
}

// Validate that every citation points to evidence actually supplied.
export function validateAgentResponseCitations(
  response: z.infer<typeof AgentResponseSchema>,
  evidence: z.infer<typeof EvidencePackageSchema>,
): void {
  const availableIds = new Set(
    evidence.items.map((item) => item.id)
  );

  const invalidIds = response.citations
    .map((citation) => citation.evidenceId)
    .filter((id) => !availableIds.has(id));

  if (invalidIds.length > 0) {
    throw new Error(
      `Response contains unknown evidence citations: ${invalidIds.join(", ")}`
    );
  }
}