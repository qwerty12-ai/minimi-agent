import { describe, expect, it } from "vitest";

import { evaluationDataset } from "../evaluation/dataset.js";
import { evaluationFixtures } from "../evaluation/fixtures.js";

describe("Evaluation Dataset", () => {
  it("contains exactly ten evaluation scenarios", () => {
    expect(evaluationDataset).toHaveLength(10);
  });

  it("contains unique scenario IDs", () => {
    const ids = evaluationDataset.map((scenario) => scenario.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains all four agent intents", () => {
    const intents = new Set(
      evaluationDataset.map((scenario) => scenario.intent),
    );

    expect(intents).toEqual(
      new Set(["RECALL", "RESEARCH", "VERIFY", "COMPARE"]),
    );
  });

  it("provides a fixture for every scenario", () => {
    for (const scenario of evaluationDataset) {
      expect(
        evaluationFixtures[scenario.fixtureId],
        `Missing fixture for ${scenario.id}`,
      ).toBeDefined();
    }
  });

  it("provides acceptance criteria for every scenario", () => {
    for (const scenario of evaluationDataset) {
      expect(scenario.acceptanceCriteria.length).toBeGreaterThan(0);

      for (const criterion of scenario.acceptanceCriteria) {
        expect(criterion.trim()).not.toBe("");
      }
    }
  });

  it("contains no empty scenario descriptions or messages", () => {
    for (const scenario of evaluationDataset) {
      expect(scenario.name.trim()).not.toBe("");
      expect(scenario.message.trim()).not.toBe("");
    }
  });

  it("uses valid research fixture structures", () => {
    for (const fixture of Object.values(evaluationFixtures)) {
      expect(Array.isArray(fixture.researchResults)).toBe(true);
      expect(Array.isArray(fixture.memoryEvidence)).toBe(true);
      expect(Array.isArray(fixture.historicalEvidence)).toBe(true);
      expect(Array.isArray(fixture.currentEvidence)).toBe(true);
    }
  });

  it("includes an empty research fixture for insufficient evidence evaluation", () => {
    expect(
      evaluationFixtures.empty_research.researchResults,
    ).toEqual([]);
  });

  it("includes distinct historical and current evidence for changed information", () => {
    const fixture = evaluationFixtures.changed_verification;

    expect(fixture.historicalEvidence).not.toEqual(
      fixture.currentEvidence,
    );
  });

  it("includes no current evidence for inconclusive verification", () => {
    const fixture = evaluationFixtures.inconclusive_verification;

    expect(fixture.historicalEvidence.length).toBeGreaterThan(0);
    expect(fixture.currentEvidence).toEqual([]);
  });
});