import { describe, expect, it } from "vitest";

import {
  parseAgentExecutionRequest,
  parseMemoryContext,
  parseResearchContext,
  parseEvidenceItem,
  parseEvidencePackage,
  parseSynthesisRequest,
  parseAgentResponse,
  parseAgentExecutionError,
  validateAgentResponseCitations,
} from "../src/agent/orchestration-schema.js";

const timestamp = "2026-11-11T10:00:00.000Z";

const evidencePackage = {
  collectedAt: timestamp,
  items: [
    {
      id: "evidence-1",
      sourceType: "memory_record",
      sourceId: "memory-1",
      content: "The user previously researched PostgreSQL.",
      createdAt: timestamp,
    },
    {
      id: "evidence-2",
      sourceType: "research_result",
      sourceId: "result-1",
      content: "PostgreSQL is an open-source relational database.",
      createdAt: timestamp,
      title: "PostgreSQL documentation",
      sourceUrl: "https://www.postgresql.org/",
    },
  ],
} as const;

describe("Orchestration domain contracts", () => {
  describe("AgentExecutionRequest", () => {
    it("accepts a valid request", () => {
      expect(
        parseAgentExecutionRequest({
          message: "Research PostgreSQL.",
          conversationId: "conversation-1",
        }).message
      ).toBe("Research PostgreSQL.");
    });

    it("trims the request message", () => {
      expect(
        parseAgentExecutionRequest({
          message: "  Research PostgreSQL.  ",
        }).message
      ).toBe("Research PostgreSQL.");
    });

    it("rejects an empty message", () => {
      expect(() =>
        parseAgentExecutionRequest({ message: "   " })
      ).toThrow();
    });

    it("rejects unknown properties", () => {
      expect(() =>
        parseAgentExecutionRequest({
          message: "Research PostgreSQL.",
          unexpected: true,
        })
      ).toThrow();
    });
  });

  describe("MemoryContext", () => {
    it("accepts retrieved memory results", () => {
      const result = parseMemoryContext({
        query: "PostgreSQL",
        retrievedAt: timestamp,
        results: [
          {
            sourceType: "memory_record",
            sourceId: "memory-1",
            content: "Previously researched PostgreSQL.",
            createdAt: timestamp,
            rank: -1.25,
            kind: "fact",
          },
        ],
      });

      expect(result.results).toHaveLength(1);
    });

    it("accepts an empty memory result set", () => {
      const result = parseMemoryContext({
        query: "Unknown topic",
        retrievedAt: timestamp,
        results: [],
      });

      expect(result.results).toEqual([]);
    });

    it("rejects an invalid memory source type", () => {
      expect(() =>
        parseMemoryContext({
          query: "PostgreSQL",
          retrievedAt: timestamp,
          results: [
            {
              sourceType: "unknown",
              sourceId: "memory-1",
              content: "Some memory",
              createdAt: timestamp,
              rank: 1,
            },
          ],
        })
      ).toThrow();
    });
  });

  describe("ResearchContext", () => {
    it("accepts normalized research results", () => {
      const result = parseResearchContext({
        query: "PostgreSQL",
        provider: "searxng",
        searchedAt: timestamp,
        results: [
          {
            title: "PostgreSQL",
            url: "https://www.postgresql.org/",
            snippet: "Open-source relational database.",
            source: "PostgreSQL",
          },
        ],
      });

      expect(result.provider).toBe("searxng");
      expect(result.results).toHaveLength(1);
    });

    it("rejects invalid research result URLs", () => {
      expect(() =>
        parseResearchContext({
          query: "PostgreSQL",
          provider: "searxng",
          searchedAt: timestamp,
          results: [
            {
              title: "PostgreSQL",
              url: "not-a-url",
              snippet: "Database information.",
              source: "Example",
            },
          ],
        })
      ).toThrow();
    });
  });

  describe("EvidenceItem", () => {
    it("accepts memory evidence", () => {
      const result = parseEvidenceItem(
        evidencePackage.items[0]
      );

      expect(result.sourceType).toBe("memory_record");
    });

    it("accepts research evidence with a source URL", () => {
      const result = parseEvidenceItem(
        evidencePackage.items[1]
      );

      expect(result.sourceUrl).toBe(
        "https://www.postgresql.org/"
      );
    });

    it("rejects empty evidence content", () => {
      expect(() =>
        parseEvidenceItem({
          id: "evidence-3",
          sourceType: "memory_record",
          sourceId: "memory-3",
          content: "   ",
          createdAt: timestamp,
        })
      ).toThrow();
    });
  });

  describe("EvidencePackage", () => {
    it("accepts a package containing multiple evidence sources", () => {
      const result = parseEvidencePackage(evidencePackage);

      expect(result.items).toHaveLength(2);
    });

    it("accepts an empty evidence package", () => {
      const result = parseEvidencePackage({
        collectedAt: timestamp,
        items: [],
      });

      expect(result.items).toEqual([]);
    });

    it("rejects duplicate evidence IDs", () => {
      expect(() =>
        parseEvidencePackage({
          collectedAt: timestamp,
          items: [
            evidencePackage.items[0],
            evidencePackage.items[0],
          ],
        })
      ).toThrow("Evidence IDs must be unique.");
    });
  });

  describe("SynthesisRequest", () => {
    it("accepts a valid synthesis request", () => {
      const result = parseSynthesisRequest({
        question: "What is PostgreSQL?",
        intent: "RESEARCH",
        evidence: evidencePackage,
      });

      expect(result.intent).toBe("RESEARCH");
      expect(result.evidence.items).toHaveLength(2);
    });

    it("rejects an invalid intent", () => {
      expect(() =>
        parseSynthesisRequest({
          question: "What is PostgreSQL?",
          intent: "UNKNOWN",
          evidence: evidencePackage,
        })
      ).toThrow();
    });
  });

  describe("AgentResponse", () => {
    it("accepts a supported answer with citations", () => {
      const result = parseAgentResponse({
        answer: "PostgreSQL is an open-source relational database.",
        intent: "RESEARCH",
        status: "supported",
        citations: [
          { evidenceId: "evidence-2" },
        ],
        generatedAt: timestamp,
      });

      expect(result.status).toBe("supported");
      expect(result.citations).toHaveLength(1);
    });

    it("accepts an insufficient-evidence answer without citations", () => {
      const result = parseAgentResponse({
        answer: "There is not enough evidence to answer this question.",
        intent: "RESEARCH",
        status: "insufficient_evidence",
        citations: [],
        generatedAt: timestamp,
      });

      expect(result.status).toBe("insufficient_evidence");
    });

    it("rejects citations on an insufficient-evidence answer", () => {
      expect(() =>
        parseAgentResponse({
          answer: "There is not enough evidence.",
          intent: "RESEARCH",
          status: "insufficient_evidence",
          citations: [
            { evidenceId: "evidence-1" },
          ],
          generatedAt: timestamp,
        })
      ).toThrow();
    });

    it("rejects duplicate citation IDs", () => {
      expect(() =>
        parseAgentResponse({
          answer: "PostgreSQL is a database.",
          intent: "RESEARCH",
          status: "supported",
          citations: [
            { evidenceId: "evidence-1" },
            { evidenceId: "evidence-1" },
          ],
          generatedAt: timestamp,
        })
      ).toThrow("Citation IDs must be unique.");
    });

    it("rejects citations that do not exist in the evidence package", () => {
      const response = parseAgentResponse({
        answer: "PostgreSQL is a database.",
        intent: "RESEARCH",
        status: "supported",
        citations: [
          { evidenceId: "nonexistent-evidence" },
        ],
        generatedAt: timestamp,
      });

      expect(() =>
        validateAgentResponseCitations(
          response,
          parseEvidencePackage(evidencePackage)
        )
      ).toThrow("unknown evidence citations");
    });

    it("accepts citations that exist in the evidence package", () => {
      const response = parseAgentResponse({
        answer: "PostgreSQL is a database.",
        intent: "RESEARCH",
        status: "supported",
        citations: [
          { evidenceId: "evidence-2" },
        ],
        generatedAt: timestamp,
      });

      expect(() =>
        validateAgentResponseCitations(
          response,
          parseEvidencePackage(evidencePackage)
        )
      ).not.toThrow();
    });
  });

  describe("AgentExecutionError", () => {
    it("accepts a valid research error", () => {
      const result = parseAgentExecutionError({
        stage: "research",
        code: "RESEARCH_FAILED",
        message: "Search provider unavailable.",
        retryable: true,
      });

      expect(result.retryable).toBe(true);
    });

    it("rejects an unknown error stage", () => {
      expect(() =>
        parseAgentExecutionError({
          stage: "unknown",
          code: "RESEARCH_FAILED",
          message: "Search failed.",
          retryable: true,
        })
      ).toThrow();
    });

    it("rejects an unknown error code", () => {
      expect(() =>
        parseAgentExecutionError({
          stage: "research",
          code: "UNKNOWN_ERROR",
          message: "Search failed.",
          retryable: true,
        })
      ).toThrow();
    });
  });
});