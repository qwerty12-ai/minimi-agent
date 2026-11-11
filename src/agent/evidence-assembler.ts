import type { MemoryContext, ResearchContext, EvidenceItem, EvidencePackage } from "./orchestration-types.js";
import { parseEvidencePackage } from "./orchestration-schema.js";

export class EvidenceAssemblyError extends Error {
  readonly stage = "evidence" as const;
  readonly code = "EVIDENCE_ASSEMBLY_FAILED" as const;
  readonly retryable = false;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EvidenceAssemblyError";
  }
}

function createEvidenceId(
  sourceType: EvidenceItem["sourceType"],
  sourceId: string,
): string {
  return `${sourceType}:${sourceId}`;
}

function normalizeContent(value: string): string {
  return value.replace(/[\s\u00A0]+/g, " ").trim();
}

export class EvidenceAssembler {
  constructor(
    private readonly clock: () => Date = () => new Date(),
  ) {}

  assemble(
    memory: MemoryContext | null,
    research: ResearchContext | null,
  ): EvidencePackage {
    try {
      const items: EvidenceItem[] = [];
      const seenIds = new Set<string>();

      const addEvidence = (item: EvidenceItem): void => {
        if (seenIds.has(item.id)) {
          return;
        }

        seenIds.add(item.id);
        items.push(item);
      };

      if (memory) {
        for (const result of memory.results) {
          const content = normalizeContent(result.content);

          if (!content) {
            continue;
          }

          addEvidence({
            id: createEvidenceId(result.sourceType, result.sourceId),
            sourceType: result.sourceType,
            sourceId: result.sourceId,
            content,
            createdAt: result.createdAt,
          });
        }
      }

      if (research) {
        for (const result of research.results) {
          const content = normalizeContent(result.snippet);

          if (!content) {
            continue;
          }

          const sourceId = result.url;

          addEvidence({
            id: createEvidenceId("research_result", sourceId),
            sourceType: "research_result",
            sourceId,
            content,
            createdAt: result.publishedAt ?? research.searchedAt,
            title: result.title,
            sourceUrl: result.url,
          });
        }
      }

      const evidencePackage: EvidencePackage = {
        collectedAt: this.clock().toISOString(),
        items,
      };

      parseEvidencePackage(evidencePackage);

      return evidencePackage;
    } catch (error) {
      if (error instanceof EvidenceAssemblyError) {
        throw error;
      }

      throw new EvidenceAssemblyError(
        "Failed to assemble a valid evidence package.",
        { cause: error },
      );
    }
  }
}