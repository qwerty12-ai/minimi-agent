import { describe, expect, it, vi } from "vitest";
import { EvidenceAssembler, EvidenceAssemblyError } from "../src/agent/evidence-assembler.js";
import type { MemoryContext, ResearchContext } from "../src/agent/orchestration-types.js";

const fixedDate = "2026-11-11T10:00:00.000Z";

const memoryContext: MemoryContext = {
  query: "What does the project do?",
  retrievedAt: fixedDate,
  results: [
    {
      sourceType: "conversation_message",
      sourceId: "message-1",
      content: "  The project is a research agent.  ",
      createdAt: fixedDate,
      rank: 1,
    },
    {
      sourceType: "memory_record",
      sourceId: "memory-1",
      content: "The project uses TypeScript.",
      createdAt: fixedDate,
      rank: 2,
      kind: "fact",
    },
  ],
};

const researchContext: ResearchContext = {
  query: "What does the project do?",
  provider: "searxng",
  searchedAt: fixedDate,
  results: [
    {
      title: "Project Documentation",
      url: "https://example.com/docs",
      snippet: "Official project documentation.",
      source: "example.com",
      publishedAt: "2026-11-10T10:00:00.000Z",
    },
    {
      title: "Project Overview",
      url: "https://example.com/overview",
      snippet: "An overview of the project.",
      source: "example.com",
    },
  ],
};

describe("EvidenceAssembler", () => {
  it("assembles memory and research evidence", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const result = assembler.assemble(memoryContext, researchContext);

    expect(result.collectedAt).toBe(fixedDate);
    expect(result.items).toHaveLength(4);
  });

  it("preserves memory source information", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const result = assembler.assemble(memoryContext, null);

    expect(result.items[0]).toEqual({
      id: "conversation_message:message-1",
      sourceType: "conversation_message",
      sourceId: "message-1",
      content: "The project is a research agent.",
      createdAt: fixedDate,
    });
  });

  it("preserves research title and URL", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const result = assembler.assemble(null, researchContext);

    expect(result.items[0]).toEqual({
      id: "research_result:https://example.com/docs",
      sourceType: "research_result",
      sourceId: "https://example.com/docs",
      content: "Official project documentation.",
      createdAt: "2026-11-10T10:00:00.000Z",
      title: "Project Documentation",
      sourceUrl: "https://example.com/docs",
    });
  });

  it("uses searchedAt when a research result has no publication date", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const result = assembler.assemble(null, researchContext);

    expect(result.items[1].createdAt).toBe(fixedDate);
  });

  it("normalizes whitespace in evidence content", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const result = assembler.assemble(memoryContext, null);

    expect(result.items[0].content).toBe(
      "The project is a research agent.",
    );
  });

  it("removes duplicate evidence IDs", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const duplicateMemory: MemoryContext = {
      ...memoryContext,
      results: [
        memoryContext.results[0],
        {
          ...memoryContext.results[0],
          content: "Duplicate content.",
        },
      ],
    };

    const result = assembler.assemble(duplicateMemory, null);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe(
      "The project is a research agent.",
    );
  });

  it("removes duplicate research URLs", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const duplicateResearch: ResearchContext = {
      ...researchContext,
      results: [
        researchContext.results[0],
        {
          ...researchContext.results[0],
          title: "Duplicate result",
          snippet: "Duplicate snippet.",
        },
      ],
    };

    const result = assembler.assemble(null, duplicateResearch);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Project Documentation");
  });

  it("skips memory results with empty content", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const emptyMemory: MemoryContext = {
      ...memoryContext,
      results: [
        {
          ...memoryContext.results[0],
          content: "   ",
        },
      ],
    };

    const result = assembler.assemble(emptyMemory, null);

    expect(result.items).toHaveLength(0);
  });

  it("skips research results with empty snippets", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const emptyResearch: ResearchContext = {
      ...researchContext,
      results: [
        {
          ...researchContext.results[0],
          snippet: "   ",
        },
      ],
    };

    const result = assembler.assemble(null, emptyResearch);

    expect(result.items).toHaveLength(0);
  });

  it("supports an empty evidence package", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const result = assembler.assemble(null, null);

    expect(result).toEqual({
      collectedAt: fixedDate,
      items: [],
    });
  });

  it("supports memory-only evidence", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const result = assembler.assemble(memoryContext, null);

    expect(result.items).toHaveLength(2);
    expect(result.items.every(
      (item) => item.sourceType !== "research_result",
    )).toBe(true);
  });

  it("supports research-only evidence", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const result = assembler.assemble(null, researchContext);

    expect(result.items).toHaveLength(2);
    expect(result.items.every(
      (item) => item.sourceType === "research_result",
    )).toBe(true);
  });

  it("wraps invalid evidence timestamps in EvidenceAssemblyError", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const invalidMemory: MemoryContext = {
      ...memoryContext,
      results: [
        {
          ...memoryContext.results[0],
          createdAt: "not-a-date",
        },
      ],
    };

    expect(() => assembler.assemble(invalidMemory, null))
      .toThrow(EvidenceAssemblyError);
  });

  it("wraps an invalid collection timestamp in EvidenceAssemblyError", () => {
    const assembler = new EvidenceAssembler(() => new Date("invalid"));

    expect(() => assembler.assemble(null, null))
      .toThrow(EvidenceAssemblyError);
  });

  it("preserves the original validation error as the cause", () => {
    const assembler = new EvidenceAssembler(() => new Date(fixedDate));

    const invalidMemory: MemoryContext = {
      ...memoryContext,
      results: [
        {
          ...memoryContext.results[0],
          createdAt: "not-a-date",
        },
      ],
    };

    try {
      assembler.assemble(invalidMemory, null);
      throw new Error("Expected evidence assembly to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(EvidenceAssemblyError);
      expect((error as EvidenceAssemblyError).cause).toBeDefined();
    }
  });
});