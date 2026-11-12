import type { ExecutionPlan } from "./types.js";
import type {
  MemorySearchResult,
} from "../memory/types.js";
import type {
  SearchResult,
} from "../research/types.js";

// The request entering the orchestration pipeline.
export interface AgentExecutionRequest {
  message: string;
  conversationId?: string;
}

// Context retrieved from persistent memory.
export interface MemoryContext {
  query: string;
  retrievedAt: string;
  results: MemorySearchResult[];
}

// Context returned by research execution.
export interface ResearchContext {
  query: string;
  provider: string;
  searchedAt: string;
  results: SearchResult[];
}

// Normalized evidence from memory or research.
export type EvidenceSourceType =
  | "conversation_message"
  | "memory_record"
  | "research_result";

export interface EvidenceItem {
  id: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  content: string;
  createdAt: string;
  title?: string;
  sourceUrl?: string;
}

// Combined evidence passed to the synthesizer.
export interface EvidencePackage {
  collectedAt: string;
  items: EvidenceItem[];
}

// Input supplied to grounded synthesis.
export interface SynthesisRequest {
  question: string;
  intent: ExecutionPlan["intent"];
  evidence: EvidencePackage;
}

// How well the answer is supported by available evidence.
export type SynthesisStatus =
  | "supported"
  | "partially_supported"
  | "insufficient_evidence";

// A reference connecting an answer to supplied evidence.
export interface EvidenceCitation {
  evidenceId: string;
}

// Final response returned by the agent.
export interface AgentResponse {
  answer: string;
  intent: ExecutionPlan["intent"];
  status: SynthesisStatus;
  citations: EvidenceCitation[];
  generatedAt: string;
}

export interface AgentExecutionResult extends AgentResponse {
  conversationId: string;
}

// Stages at which orchestration can encounter a failure.
export type ExecutionStage =
  | "classification"
  | "memory"
  | "research"
  | "evidence"
  | "synthesis";

// Stable error categories for future orchestration boundaries.
export type AgentExecutionErrorCode =
  | "CLASSIFICATION_FAILED"
  | "MEMORY_RETRIEVAL_FAILED"
  | "RESEARCH_FAILED"
  | "EVIDENCE_ASSEMBLY_FAILED"
  | "SYNTHESIS_FAILED"
  | "INVALID_SYNTHESIS";

export interface AgentExecutionError {
  stage: ExecutionStage;
  code: AgentExecutionErrorCode;
  message: string;
  retryable: boolean;
}