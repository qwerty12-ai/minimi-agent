import type {
  AgentResponse,
  EvidencePackage,
} from "../src/agent/orchestration-types.js";

import type { Intent } from "../src/agent/types.js";

export interface EvaluationInput {
  caseId: string;
  expectedIntent: Intent;
  expectedStatus: AgentResponse["status"];
  response: AgentResponse;
  evidence: EvidencePackage;
  requiredEvidenceIds?: string[];
}

export type EvaluationMetricName =
  | "intent_match"
  | "status_match"
  | "citation_integrity"
  | "citation_discipline"
  | "evidence_coverage";

export interface EvaluationMetric {
  name: EvaluationMetricName;
  passed: boolean;
  details: string;
}

export interface EvaluationReport {
  caseId: string;
  passed: boolean;
  score: number;
  totalMetrics: number;
  passedMetrics: number;
  metrics: EvaluationMetric[];
  requiresSemanticReview: true;
  semanticReviewCriteria: string[];
}