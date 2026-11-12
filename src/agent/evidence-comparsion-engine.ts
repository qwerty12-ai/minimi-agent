import { createHash } from "node:crypto";

import type { ResearchSnapshot } from "../memory/types.js";
import type { SearchResult } from "../research/types.js";
import type { ComparisonResult } from "./verification-types.js";

import { parseComparisonResult } from "./verification-schema.js";

export class EvidenceComparisonEngine {
    constructor(
        private readonly clock: () => Date = () => new Date(),
    ) { }

    compare(
        historical: ResearchSnapshot,
        current: ResearchSnapshot,
    ): ComparisonResult[] {
        if (historical.id === current.id) {
            throw new Error("Cannot compare a research snapshot with itself.");
        }

        const historicalEvidence = this.indexEvidence(historical.results);
        const currentEvidence = this.indexEvidence(current.results);

        const results: ComparisonResult[] = [];
        const matchedKeys = new Set<string>();

        for (const [key, historicalItem] of historicalEvidence) {
            const currentItem = currentEvidence.get(key);

            if (key.startsWith("invalid:")) {
                if (currentItem) {
                    matchedKeys.add(key);
                }

                results.push(
                    this.createResult(
                        historical.id,
                        current.id,
                        "inconclusive",
                        [historicalItem.id],
                        currentItem ? [currentItem.id] : [],
                        "Evidence could not be compared because its URL is invalid.",
                    ),
                );
                continue;
            }

            if (!currentItem) {
                results.push(
                    this.createResult(
                        historical.id,
                        current.id,
                        "historical_only",
                        [historicalItem.id],
                        [],
                        "This evidence appeared in the historical snapshot but not in the current snapshot.",
                    ),
                );
                continue;
            }

            matchedKeys.add(key);

            const unchanged = this.hasSameContent(
                historicalItem.result,
                currentItem.result,
            );

            results.push(
                this.createResult(
                    historical.id,
                    current.id,
                    unchanged ? "unchanged" : "changed",
                    [historicalItem.id],
                    [currentItem.id],
                    unchanged
                        ? "The evidence URL and available content are unchanged."
                        : "The evidence URL matches, but its title, snippet, source, or publication date has changed.",
                ),
            );
        }

        for (const [key, currentItem] of currentEvidence) {
            if (matchedKeys.has(key)) {
                continue;
            }

            if (historicalEvidence.has(key)) {
                continue;
            }

            results.push(
                this.createResult(
                    historical.id,
                    current.id,
                    "current_only",
                    [],
                    [currentItem.id],
                    "This evidence appears in the current snapshot but not in the historical snapshot.",
                ),
            );
        }

        return results;
    }

    private indexEvidence(
        evidence: SearchResult[],
    ): Map<string, { id: string; result: SearchResult }> {
        const indexed = new Map<
            string,
            { id: string; result: SearchResult }
        >();

        for (const result of evidence) {
            const normalizedUrl = this.normalizeUrl(result.url);
            const key = normalizedUrl ?? `invalid:${result.url}`;

            if (indexed.has(key)) {
                continue;
            }

            indexed.set(key, {
                id: this.hash(`evidence:${key}`),
                result,
            });
        }

        return indexed;
    }

    private normalizeUrl(value: string): string | null {
        try {
            const url = new URL(value);

            if (url.protocol !== "http:" && url.protocol !== "https:") {
                return null;
            }

            url.hash = "";

            return url.toString();
        } catch {
            return null;
        }
    }

    private hasSameContent(
        historical: SearchResult,
        current: SearchResult,
    ): boolean {
        return (
            this.normalizeText(historical.title) ===
            this.normalizeText(current.title) &&
            this.normalizeText(historical.snippet) ===
            this.normalizeText(current.snippet) &&
            this.normalizeText(historical.source) ===
            this.normalizeText(current.source) &&
            (historical.publishedAt ?? null) ===
            (current.publishedAt ?? null)
        );
    }

    private normalizeText(value: string): string {
        return value.trim().replace(/\s+/g, " ");
    }

    private createResult(
        historicalSnapshotId: string,
        currentSnapshotId: string,
        status: ComparisonResult["status"],
        historicalEvidenceIds: string[],
        currentEvidenceIds: string[],
        explanation: string,
    ): ComparisonResult {
        const comparedAt = this.clock().toISOString();

        const id = this.hash(
            [
                historicalSnapshotId,
                currentSnapshotId,
                status,
                ...historicalEvidenceIds,
                ...currentEvidenceIds,
            ].join(":"),
        );

        return parseComparisonResult({
            id,
            historicalSnapshotId,
            currentSnapshotId,
            status,
            historicalEvidenceIds,
            currentEvidenceIds,
            explanation,
            comparedAt,
        });
    }

    private hash(value: string): string {
        return createHash("sha256")
            .update(value)
            .digest("hex");
    }
}