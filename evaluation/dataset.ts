import type { Intent } from "../src/agent/types.js";

export type EvaluationOutcome =
  | "supported_answer"
  | "multi_source_synthesis"
  | "insufficient_evidence"
  | "cautious_conflict_handling"
  | "memory_recall"
  | "acknowledge_missing_memory"
  | "unchanged_evidence"
  | "changed_evidence"
  | "inconclusive_verification"
  | "historical_comparison";

export interface EvaluationCase {
  id: string;
  name: string;
  intent: Intent;
  message: string;
  fixtureId: string;
  expectedOutcome: EvaluationOutcome;
  acceptanceCriteria: string[];
}

export const evaluationDataset: EvaluationCase[] = [
  {
    id: "E01",
    name: "Direct factual research",
    intent: "RESEARCH",
    message: "Find the official TypeScript documentation.",
    fixtureId: "direct_research",
    expectedOutcome: "supported_answer",
    acceptanceCriteria: [
      "Uses relevant research evidence.",
      "Produces an answer supported by the supplied evidence.",
      "Citations reference supplied evidence.",
    ],
  },
  {
    id: "E02",
    name: "Multi-source research",
    intent: "RESEARCH",
    message: "Explain how TypeScript and Node.js relate to each other.",
    fixtureId: "multi_source",
    expectedOutcome: "multi_source_synthesis",
    acceptanceCriteria: [
      "Uses evidence from multiple sources.",
      "Combines the evidence into a coherent answer.",
      "Does not attribute claims to unrelated sources.",
    ],
  },
  {
    id: "E03",
    name: "Insufficient research evidence",
    intent: "RESEARCH",
    message: "What is the exact current price of an undocumented product?",
    fixtureId: "empty_research",
    expectedOutcome: "insufficient_evidence",
    acceptanceCriteria: [
      "Does not invent an answer.",
      "Acknowledges insufficient evidence.",
      "Does not fabricate citations.",
    ],
  },
  {
    id: "E04",
    name: "Conflicting research sources",
    intent: "RESEARCH",
    message: "What is the reported release date?",
    fixtureId: "conflicting_sources",
    expectedOutcome: "cautious_conflict_handling",
    acceptanceCriteria: [
      "Recognizes conflicting evidence.",
      "Does not present either conflicting claim as certain without justification.",
      "Preserves source attribution.",
    ],
  },
  {
    id: "E05",
    name: "Historical memory recall",
    intent: "RECALL",
    message: "What did I previously research about TypeScript?",
    fixtureId: "historical_memory",
    expectedOutcome: "memory_recall",
    acceptanceCriteria: [
      "Uses retrieved historical memory.",
      "Does not claim information that memory does not contain.",
    ],
  },
  {
    id: "E06",
    name: "Missing historical memory",
    intent: "RECALL",
    message: "What was the exact price I mentioned in a previous conversation?",
    fixtureId: "missing_memory",
    expectedOutcome: "acknowledge_missing_memory",
    acceptanceCriteria: [
      "Acknowledges that the requested information is unavailable.",
      "Does not invent previous conversation details.",
    ],
  },
  {
    id: "E07",
    name: "Unchanged historical evidence",
    intent: "VERIFY",
    message: "Check whether the historical TypeScript information is still consistent.",
    fixtureId: "unchanged_verification",
    expectedOutcome: "unchanged_evidence",
    acceptanceCriteria: [
      "Compares historical and current evidence.",
      "Identifies unchanged evidence correctly.",
      "Retains the evidence references.",
    ],
  },
  {
    id: "E08",
    name: "Changed historical evidence",
    intent: "VERIFY",
    message: "Check whether the previously recorded product price has changed.",
    fixtureId: "changed_verification",
    expectedOutcome: "changed_evidence",
    acceptanceCriteria: [
      "Detects the difference between historical and current evidence.",
      "Identifies the changed information.",
      "Does not misrepresent the direction of the change.",
    ],
  },
  {
    id: "E09",
    name: "Inconclusive historical verification",
    intent: "VERIFY",
    message: "Verify whether the previously recorded free plan is still available.",
    fixtureId: "inconclusive_verification",
    expectedOutcome: "inconclusive_verification",
    acceptanceCriteria: [
      "Recognizes missing current evidence.",
      "Does not classify missing evidence as proof of change.",
      "Returns an inconclusive outcome.",
    ],
  },
  {
    id: "E10",
    name: "Historical and current comparison",
    intent: "COMPARE",
    message: "Compare the historical product price with the current price.",
    fixtureId: "historical_comparison",
    expectedOutcome: "historical_comparison",
    acceptanceCriteria: [
      "Uses both historical and current evidence.",
      "Identifies the price difference.",
      "Preserves the distinction between historical and current information.",
    ],
  },
];