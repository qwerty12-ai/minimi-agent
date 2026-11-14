import { describe, expect, it } from "vitest";

import {
  EvaluationEvaluator,
  EvaluationInputError,
} from "../evaluation/evaluator.js";

import type { EvaluationInput } from "../evaluation/types.js";

const fixedDate = "2026-11-14T10:00:00.000Z";

const evidence = {
  collectedAt: fixedDate,
  items: [
    {
      id: "research-1",
      sourceType: "research_result" as const,
      sourceId: "https://example.com/docs",
      content: "TypeScript is a strongly typed programming language.",
      createdAt: fixedDate,
      title: "TypeScript Documentation",
      sourceUrl: "https://example.com/docs",
    },
    {
      id: "research-2",
      sourceType: "research_result" as const,
      sourceId: "https://example.com/node",
      content: "Node.js is a JavaScript runtime.",
      createdAt: fixedDate,
      title: "Node.js Documentation",
      sourceUrl: "https://example.com/node",
    },
  ],
};

const validInput: EvaluationInput = {
  caseId: "E01",
  expectedIntent: "RESEARCH",
  expectedStatus: "supported",
  response: {
    answer: "TypeScript is a strongly typed programming language.",
    intent: "RESEARCH",
    status: "supported",
    citations: [{ evidenceId: "research-1" }],
    generatedAt: fixedDate,
  },
  evidence,
  requiredEvidenceIds: ["research-1"],
};

describe("EvaluationEvaluator", () => {
  const evaluator = new EvaluationEvaluator();

  it("passes a fully valid evaluation", () => {
    const result = evaluator.evaluate(validInput);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.passedMetrics).toBe(5);
    expect(result.totalMetrics).toBe(5);
  });

  it("returns individual metric results", () => {
    const result = evaluator.evaluate(validInput);

    expect(result.metrics.map((metric) => metric.name)).toEqual([
      "intent_match",
      "status_match",
      "citation_integrity",
      "citation_discipline",
      "evidence_coverage",
    ]);
  });

  it("requires semantic review", () => {
    const result = evaluator.evaluate(validInput);

    expect(result.requiresSemanticReview).toBe(true);
    expect(result.semanticReviewCriteria.length).toBeGreaterThan(0);
  });

  it("detects an incorrect intent", () => {
    const result = evaluator.evaluate({
      ...validInput,
      response: {
        ...validInput.response,
        intent: "RECALL",
      },
    });

    expect(result.passed).toBe(false);
    expect(
      result.metrics.find((metric) => metric.name === "intent_match")
        ?.passed,
    ).toBe(false);
  });

  it("detects an incorrect synthesis status", () => {
    const result = evaluator.evaluate({
      ...validInput,
      response: {
        ...validInput.response,
        status: "partially_supported",
      },
    });

    expect(
      result.metrics.find((metric) => metric.name === "status_match")
        ?.passed,
    ).toBe(false);
  });

  it("detects citations referencing unknown evidence", () => {
    const result = evaluator.evaluate({
      ...validInput,
      response: {
        ...validInput.response,
        citations: [{ evidenceId: "fabricated-id" }],
      },
    });

    expect(
      result.metrics.find(
        (metric) => metric.name === "citation_integrity",
      )?.passed,
    ).toBe(false);
  });

  it("detects duplicate citations", () => {
    const result = evaluator.evaluate({
      ...validInput,
      response: {
        ...validInput.response,
        citations: [
          { evidenceId: "research-1" },
          { evidenceId: "research-1" },
        ],
      },
    });

    expect(
      result.metrics.find(
        (metric) => metric.name === "citation_integrity",
      )?.passed,
    ).toBe(false);
  });

  it("rejects supported responses without citations", () => {
    const result = evaluator.evaluate({
      ...validInput,
      response: {
        ...validInput.response,
        citations: [],
      },
    });

    expect(
      result.metrics.find(
        (metric) => metric.name === "citation_discipline",
      )?.passed,
    ).toBe(false);
  });

  it("accepts insufficient evidence without citations", () => {
    const result = evaluator.evaluate({
      ...validInput,
      expectedStatus: "insufficient_evidence",
      response: {
        ...validInput.response,
        answer: "There is insufficient evidence.",
        status: "insufficient_evidence",
        citations: [],
      },
    });

    expect(
      result.metrics.find(
        (metric) => metric.name === "citation_discipline",
      )?.passed,
    ).toBe(true);
  });

  it("rejects insufficient evidence responses with citations", () => {
    const result = evaluator.evaluate({
      ...validInput,
      expectedStatus: "insufficient_evidence",
      response: {
        ...validInput.response,
        status: "insufficient_evidence",
        citations: [{ evidenceId: "research-1" }],
      },
    });

    expect(
      result.metrics.find(
        (metric) => metric.name === "citation_discipline",
      )?.passed,
    ).toBe(false);
  });

  it("detects missing required evidence citations", () => {
    const result = evaluator.evaluate({
      ...validInput,
      requiredEvidenceIds: ["research-1", "research-2"],
    });

    expect(
      result.metrics.find(
        (metric) => metric.name === "evidence_coverage",
      )?.passed,
    ).toBe(false);
  });

  it("passes when all required evidence is cited", () => {
    const result = evaluator.evaluate({
      ...validInput,
      requiredEvidenceIds: ["research-1", "research-2"],
      response: {
        ...validInput.response,
        citations: [
          { evidenceId: "research-1" },
          { evidenceId: "research-2" },
        ],
      },
    });

    expect(
      result.metrics.find(
        (metric) => metric.name === "evidence_coverage",
      )?.passed,
    ).toBe(true);
  });

  it("rejects a supported answer when no evidence exists", () => {
    const result = evaluator.evaluate({
      ...validInput,
      evidence: {
        collectedAt: fixedDate,
        items: [],
      },
    });

    expect(
      result.metrics.find(
        (metric) => metric.name === "citation_discipline",
      )?.passed,
    ).toBe(false);
  });

  it("rejects an empty evaluation case ID", () => {
    expect(() =>
      evaluator.evaluate({
        ...validInput,
        caseId: "   ",
      }),
    ).toThrow(EvaluationInputError);
  });

  it("rejects empty required evidence IDs", () => {
    expect(() =>
      evaluator.evaluate({
        ...validInput,
        requiredEvidenceIds: ["   "],
      }),
    ).toThrow(EvaluationInputError);
  });

  it("produces a deterministic score", () => {
    const first = evaluator.evaluate(validInput);
    const second = evaluator.evaluate(validInput);

    expect(first).toEqual(second);
  });
});