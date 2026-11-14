import type {
  EvaluationInput,
  EvaluationMetric,
  EvaluationReport,
} from "./types.js";

export class EvaluationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationInputError";
  }
}

export class EvaluationEvaluator {
  evaluate(input: EvaluationInput): EvaluationReport {
    this.validateInput(input);

    const availableEvidenceIds = new Set(
      input.evidence.items.map((item) => item.id),
    );

    const citedEvidenceIds = input.response.citations.map(
      (citation) => citation.evidenceId,
    );

    const uniqueCitedEvidenceIds = new Set(citedEvidenceIds);

    const unknownCitations = citedEvidenceIds.filter(
      (id) => !availableEvidenceIds.has(id),
    );

    const duplicateCitations =
      uniqueCitedEvidenceIds.size !== citedEvidenceIds.length;

    const requiredEvidenceIds = input.requiredEvidenceIds ?? [];

    const missingRequiredEvidence = requiredEvidenceIds.filter(
      (id) => !uniqueCitedEvidenceIds.has(id),
    );

    const metrics: EvaluationMetric[] = [
      {
        name: "intent_match",
        passed: input.response.intent === input.expectedIntent,
        details:
          input.response.intent === input.expectedIntent
            ? "Response intent matches the expected intent."
            : `Expected ${input.expectedIntent}, received ${input.response.intent}.`,
      },
      {
        name: "status_match",
        passed: input.response.status === input.expectedStatus,
        details:
          input.response.status === input.expectedStatus
            ? "Response status matches the expected status."
            : `Expected ${input.expectedStatus}, received ${input.response.status}.`,
      },
      {
        name: "citation_integrity",
        passed:
          unknownCitations.length === 0 &&
          !duplicateCitations,
        details:
          unknownCitations.length === 0 && !duplicateCitations
            ? "All citations reference unique supplied evidence."
            : [
                unknownCitations.length > 0
                  ? `Unknown evidence IDs: ${unknownCitations.join(", ")}.`
                  : "",
                duplicateCitations
                  ? "Duplicate citation IDs were found."
                  : "",
              ].filter(Boolean).join(" "),
      },
      {
        name: "citation_discipline",
        passed: this.hasValidCitationDiscipline(input),
        details: this.getCitationDisciplineDetails(input),
      },
      {
        name: "evidence_coverage",
        passed: missingRequiredEvidence.length === 0,
        details:
          missingRequiredEvidence.length === 0
            ? "All required evidence IDs are cited."
            : `Missing required citations: ${missingRequiredEvidence.join(", ")}.`,
      },
    ];

    const passedMetrics = metrics.filter(
      (metric) => metric.passed,
    ).length;

    const totalMetrics = metrics.length;

    return {
      caseId: input.caseId,
      passed: passedMetrics === totalMetrics,
      score: Math.round(
        (passedMetrics / totalMetrics) * 100,
      ),
      totalMetrics,
      passedMetrics,
      metrics,
      requiresSemanticReview: true,
      semanticReviewCriteria: [
        "Does the answer directly address the question?",
        "Does each factual claim follow from its cited evidence?",
        "Are citations relevant to the claims they support?",
        "Are conflicting sources represented accurately?",
        "Does the answer avoid unsupported assumptions?",
      ],
    };
  }

  private validateInput(input: EvaluationInput): void {
    if (!input.caseId.trim()) {
      throw new EvaluationInputError(
        "Evaluation case ID cannot be empty.",
      );
    }

    if (
      input.requiredEvidenceIds?.some(
        (id) => !id.trim(),
      )
    ) {
      throw new EvaluationInputError(
        "Required evidence IDs cannot be empty.",
      );
    }
  }

  private hasValidCitationDiscipline(
    input: EvaluationInput,
  ): boolean {
    const citationCount = input.response.citations.length;

    if (input.response.status === "insufficient_evidence") {
      return citationCount === 0;
    }

    return (
      input.evidence.items.length > 0 &&
      citationCount > 0
    );
  }

  private getCitationDisciplineDetails(
    input: EvaluationInput,
  ): string {
    const citationCount = input.response.citations.length;

    if (input.response.status === "insufficient_evidence") {
      return citationCount === 0
        ? "Insufficient-evidence response contains no citations."
        : "Insufficient-evidence response must not contain citations.";
    }

    if (input.evidence.items.length === 0) {
      return "A supported response cannot be produced without supplied evidence.";
    }

    return citationCount > 0
      ? "Response cites supplied evidence."
      : "Response has evidence available but contains no citations.";
  }
}