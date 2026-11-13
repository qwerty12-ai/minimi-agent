import type { SearchResult } from "../src/research/types.js";

export interface EvaluationEvidence {
  title: string;
  content: string;
  sourceUrl?: string;
}

export interface EvaluationFixture {
  researchResults: SearchResult[];
  memoryEvidence: EvaluationEvidence[];
  historicalEvidence: EvaluationEvidence[];
  currentEvidence: EvaluationEvidence[];
}

const officialDocs: SearchResult = {
  title: "TypeScript Documentation",
  url: "https://www.typescriptlang.org/docs/",
  snippet: "TypeScript is a strongly typed programming language that builds on JavaScript.",
  source: "typescript-docs",
};

const officialNodeDocs: SearchResult = {
  title: "Node.js Documentation",
  url: "https://nodejs.org/en/learn",
  snippet: "Node.js is a JavaScript runtime built on the V8 JavaScript engine.",
  source: "node-docs",
};

export const evaluationFixtures: Record<string, EvaluationFixture> = {
  direct_research: {
    researchResults: [officialDocs],
    memoryEvidence: [],
    historicalEvidence: [],
    currentEvidence: [],
  },

  multi_source: {
    researchResults: [officialDocs, officialNodeDocs],
    memoryEvidence: [],
    historicalEvidence: [],
    currentEvidence: [],
  },

  empty_research: {
    researchResults: [],
    memoryEvidence: [],
    historicalEvidence: [],
    currentEvidence: [],
  },

  conflicting_sources: {
    researchResults: [
      {
        title: "Source A",
        url: "https://example.com/source-a",
        snippet: "The reported release date is March 2026.",
        source: "source-a",
      },
      {
        title: "Source B",
        url: "https://example.com/source-b",
        snippet: "The reported release date is June 2026.",
        source: "source-b",
      },
    ],
    memoryEvidence: [],
    historicalEvidence: [],
    currentEvidence: [],
  },

  historical_memory: {
    researchResults: [],
    memoryEvidence: [
      {
        title: "Previous conversation",
        content: "The user previously researched TypeScript documentation.",
      },
    ],
    historicalEvidence: [],
    currentEvidence: [],
  },

  missing_memory: {
    researchResults: [],
    memoryEvidence: [],
    historicalEvidence: [],
    currentEvidence: [],
  },

  unchanged_verification: {
    researchResults: [],
    memoryEvidence: [],
    historicalEvidence: [
      {
        title: "TypeScript Documentation",
        content: "TypeScript is a strongly typed programming language.",
        sourceUrl: "https://www.typescriptlang.org/",
      },
    ],
    currentEvidence: [
      {
        title: "TypeScript Documentation",
        content: "TypeScript is a strongly typed programming language.",
        sourceUrl: "https://www.typescriptlang.org/",
      },
    ],
  },

  changed_verification: {
    researchResults: [],
    memoryEvidence: [],
    historicalEvidence: [
      {
        title: "Product Pricing",
        content: "The monthly subscription costs $20.",
        sourceUrl: "https://example.com/pricing",
      },
    ],
    currentEvidence: [
      {
        title: "Product Pricing",
        content: "The monthly subscription costs $25.",
        sourceUrl: "https://example.com/pricing",
      },
    ],
  },

  inconclusive_verification: {
    researchResults: [],
    memoryEvidence: [],
    historicalEvidence: [
      {
        title: "Historical Research",
        content: "The service previously offered a free plan.",
        sourceUrl: "https://example.com/service",
      },
    ],
    currentEvidence: [],
  },

  historical_comparison: {
    researchResults: [],
    memoryEvidence: [],
    historicalEvidence: [
      {
        title: "Product Pricing",
        content: "The monthly subscription costs $20.",
        sourceUrl: "https://example.com/pricing",
      },
    ],
    currentEvidence: [
      {
        title: "Product Pricing",
        content: "The monthly subscription costs $25.",
        sourceUrl: "https://example.com/pricing",
      },
    ],
  },
};