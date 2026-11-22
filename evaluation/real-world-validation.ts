import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { createAgent } from "../src/agent/create-agent.js";
import { createAgentInfrastructure } from "../src/agent/create-agent-infrastructure.js";

type Outcome = "passed" | "failed" | "blocked";

type ScenarioResult = {
  name: string;
  outcome: Outcome;
  durationMs: number;
  details?: unknown;
  error?: string;
};

const results: ScenarioResult[] = [];

const supportedScenarioIds = ["01", "02", "03a", "03b", "04", "05"] as const;
type ScenarioId = (typeof supportedScenarioIds)[number];

function record(result: ScenarioResult): void {
  results.push(result);
  console.log(`\n[${result.outcome.toUpperCase()}] ${result.name}`);
  console.log(
    JSON.stringify(
      {
        details: result.details,
        error: result.error,
      },
      null,
      2,
    ),
  );
}

async function runScenario<T>(
  name: string,
  action: () => Promise<T>,
  validate: (value: T) => string | null,
): Promise<T | null> {
  const startedAt = performance.now();

  try {
    const value = await action();
    const validationError = validate(value);

    record({
      name,
      outcome: validationError === null ? "passed" : "failed",
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      details: value,
      ...(validationError ? { error: validationError } : {}),
    });

    return validationError === null ? value : null;
  } catch (error) {
    record({
      name,
      outcome: "failed",
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

function blockScenario(name: string, reason: string): void {
  record({
    name,
    outcome: "blocked",
    durationMs: 0,
    error: reason,
  });
}

function hasUsableCitations(
  citations: Array<{ evidenceId: string }>,
): boolean {
  return (
    citations.length > 0 &&
    citations.every(
      (citation) =>
        typeof citation.evidenceId === "string" &&
        citation.evidenceId.length > 0,
    )
  );
}

function createResearchEvidenceId(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex");
  return `research_result:${hash}`;
}

function parseScenarioSelection(
  rawSelection: string | undefined,
): Set<ScenarioId> {
  if (!rawSelection || rawSelection.trim().toLowerCase() === "all") {
    return new Set(supportedScenarioIds);
  }

  const requestedIds = rawSelection
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  const unsupportedIds = requestedIds.filter(
    (id) => !supportedScenarioIds.includes(id as ScenarioId),
  );

  if (unsupportedIds.length > 0) {
    throw new Error(
      `Unsupported scenario(s): ${unsupportedIds.join(", ")}. ` +
      `Supported scenarios: ${supportedScenarioIds.join(", ")} or "all".`,
    );
  }

  return new Set(requestedIds as ScenarioId[]);
}

async function main(): Promise<void> {
  const targetedScenario = process.env.M6_ONLY_SCENARIO?.trim();
  const selectedScenarios = parseScenarioSelection(targetedScenario);

  const executionScenarios = new Set(selectedScenarios);

  if (selectedScenarios.has("04")) {
    executionScenarios.add("01");
  }

  if (selectedScenarios.has("03b")) {
    executionScenarios.add("03a");
  }

  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "minimi-m6-validation-"),
  );

  const databasePath = join(temporaryDirectory, "validation.sqlite");

  const infrastructure = createAgentInfrastructure({ databasePath });
  const agent = createAgent({ infrastructure });

  try {
    console.log("MiniMi Agent — M6.5 Real-World Validation");
    console.log("==========================================");
    console.log("Providers: configured Ollama + configured SearXNG");
    console.log("Database: isolated temporary SQLite database");
    console.log("Acceptance mode: explicit assertions");

    console.log(
      `Execution mode: ${targetedScenario
        ? `Selected: ${[...selectedScenarios].join(", ")}`
        : "All scenarios"
      }`,
    );

    if (selectedScenarios.has("04") && !selectedScenarios.has("01")) {
      console.log(
        "Prerequisite: Scenario 01 will run to provide a historical snapshot for Scenario 04.",
      );
    }

    if (selectedScenarios.has("03b") && !selectedScenarios.has("03a")) {
      console.log(
        "Prerequisite: Scenario 03a will run to store recall test information for Scenario 03b.",
      );
    }

    console.log(
      `Synthesis diagnostics: ${process.env.MINIMI_SYNTHESIS_DIAGNOSTICS === "1"
        ? "enabled"
        : "disabled"
      }`,
    );

    // ============================================================
    // 1. Direct factual research
    // ============================================================

    let directResearch:
      | {
        intent: string;
        status: string;
        answer: string;
        citations: Array<{ evidenceId: string }>;
        snapshotId: string | null;
        researchResultCount: number;
        invalidCitationIds: string[];
        conversationId: string;
      }
      | null = null;

    if (executionScenarios.has("01")) {
      directResearch = await runScenario(
        "01 — Direct research",
        async () => {
          const response = await agent.execute({
            message:
              "Research the current stable release of Node.js. " +
              "Include its version and release information, using sources.",
          });

          const snapshots =
            await infrastructure.memoryStore.researchSnapshots.findByConversation(
              response.conversationId,
            );

          const snapshot = snapshots[snapshots.length - 1];

          const validEvidenceIds = new Set(
            (snapshot?.results ?? []).map((item) =>
              createResearchEvidenceId(item.url),
            ),
          );

          const invalidCitationIds = response.citations
            .map((citation) => citation.evidenceId)
            .filter((id) => !validEvidenceIds.has(id));

          return {
            intent: response.intent,
            status: response.status,
            answer: response.answer,
            citations: response.citations,
            snapshotId: snapshot?.id ?? null,
            researchResultCount: snapshot?.results.length ?? 0,
            invalidCitationIds,
            conversationId: response.conversationId,
          };
        },
        (value) => {
          if (value.intent !== "RESEARCH") {
            return "Expected RESEARCH intent.";
          }

          if (value.status === "insufficient_evidence") {
            return "Direct research returned insufficient evidence.";
          }

          if (!value.snapshotId || value.researchResultCount === 0) {
            return "No persisted research snapshot or results.";
          }

          if (!hasUsableCitations(value.citations)) {
            return "The answer has no usable citations.";
          }

          if (value.invalidCitationIds.length > 0) {
            return "The answer contains citations not present in its research snapshot.";
          }

          return null;
        },
      );
    }

    // ============================================================
    // 2. Multi-source research
    // ============================================================

    if (selectedScenarios.has("02")) {
      await runScenario(
        "02 — Multi-source research",
        async () => {
          const response = await agent.execute({
            message:
              "Compare the official TypeScript support and release " +
              "approaches of Node.js and Deno. Use multiple sources.",
          });

          const snapshots =
            await infrastructure.memoryStore.researchSnapshots.findByConversation(
              response.conversationId,
            );

          const snapshot = snapshots[snapshots.length - 1];

          const distinctDomains = [
            ...new Set(
              (snapshot?.results ?? []).map((item) => {
                try {
                  return new URL(item.url).hostname;
                } catch {
                  return item.url;
                }
              }),
            ),
          ];

          // M6.5.2 CHANGE:
          // Build the set of citation IDs that actually belong to this
          // scenario's persisted research snapshot.
          const validEvidenceIds = new Set(
            (snapshot?.results ?? []).map((item) =>
              createResearchEvidenceId(item.url),
            ),
          );

          // M6.5.2 CHANGE:
          // Identify citations that do not map to any result in the snapshot.
          // This strengthens citation integrity beyond merely checking that
          // the response contains at least one citation.
          const invalidCitationIds = response.citations
            .map((citation) => citation.evidenceId)
            .filter((id) => !validEvidenceIds.has(id));

          // M6.5.2 CHANGE:
          // Add a conservative deterministic relevance check.
          // This verifies that the answer mentions both requested subjects.
          // It does NOT attempt to judge the depth or semantic quality of
          // the comparison, and it does not penalize mentions of other runtimes.
          const mentionsNode = /\bnode\.?js\b|\bnode\b/i.test(
            response.answer,
          );
          const mentionsDeno = /\bdeno\b/i.test(response.answer);

          return {
            intent: response.intent,
            status: response.status,
            answer: response.answer,
            citations: response.citations,
            researchResultCount: snapshot?.results.length ?? 0,
            distinctDomains,
            snapshotId: snapshot?.id ?? null,

            // M6.5.2 CHANGE: Expose new assertion data in scenario output.
            mentionsNode,
            mentionsDeno,
            invalidCitationIds,
          };
        },
        (value) => {
          if (value.intent !== "RESEARCH") {
            return "Expected RESEARCH intent.";
          }

          if (value.status === "insufficient_evidence") {
            return "Multi-source research returned insufficient evidence.";
          }

          if (value.researchResultCount < 2) {
            return "Expected at least two research results.";
          }

          if (value.distinctDomains.length < 2) {
            return "Expected results from at least two distinct domains.";
          }

          if (!hasUsableCitations(value.citations)) {
            return "The answer has no usable citations.";
          }

          // M6.5.2 CHANGE:
          // Fail if any citation does not correspond to the scenario snapshot.
          if (value.invalidCitationIds.length > 0) {
            return "The answer contains citations not present in its research snapshot.";
          }

          // M6.5.2 CHANGE:
          // Fail if the response completely omits either requested subject.
          if (!value.mentionsNode || !value.mentionsDeno) {
            return "The answer does not address both Node.js and Deno.";
          }

          return null;
        },
      );
    }

    // ============================================================
    // 3. Memory storage and recall
    // ============================================================

    let memoryConversationId: string | null = null;
    let memoryStoragePassed = false;

    if (executionScenarios.has("03a")) {
      memoryConversationId = randomUUID();

      const memoryMessage =
        "For this conversation, the project codename is " +
        "Amber Kestrel. Please acknowledge this information.";

      const memoryConversationCreatedAt = new Date().toISOString();

      await infrastructure.memoryStore.conversations.create({
        id: memoryConversationId,
        title: "M6.5 memory validation",
        createdAt: memoryConversationCreatedAt,
        updatedAt: memoryConversationCreatedAt,
      });

      const storageResult = await runScenario(
        "03a — Store recall test information",
        async () => {
          let executionError: string | null = null;
          let executionResult: unknown = null;

          try {
            const response = await agent.execute({
              conversationId: memoryConversationId!,
              message: memoryMessage,
            });

            executionResult = {
              intent: response.intent,
              status: response.status,
              answer: response.answer,
            };
          } catch (error) {
            executionError = error instanceof Error
              ? error.message
              : String(error);
          }

          const indexedResults =
            await infrastructure.memoryStore.search.search(
              "Amber Kestrel",
              10,
            );

          const matchingResults = indexedResults.filter((item) =>
            item.content.toLowerCase().includes("amber kestrel"),
          );

          return {
            conversationId: memoryConversationId,
            executionResult,
            executionError,
            indexedResultCount: indexedResults.length,
            matchingResultCount: matchingResults.length,
            matchingSources: matchingResults.map((item) => ({
              sourceType: item.sourceType,
              sourceId: item.sourceId,
              content: item.content,
            })),
            messagePersisted: matchingResults.length > 0,
          };
        },
        (value) => {
          if (!value.messagePersisted) {
            return "The Amber Kestrel message was not found in indexed memory.";
          }

          return null;
        },
      );

      memoryStoragePassed = storageResult !== null;

      if (!memoryStoragePassed) {
        memoryConversationId = null;
      }
    }

    // ============================================================
    // 3b. Recall previously stored information
    // ============================================================

    if (selectedScenarios.has("03b")) {
      if (!memoryStoragePassed || !memoryConversationId) {
        blockScenario(
          "03b — Recall previously stored information",
          "Scenario 03a failed to persist the memory; recall cannot run.",
        );
      } else {
        await runScenario(
          "03b — Recall previously stored information",
          async () => {
            const response = await agent.execute({
              conversationId: memoryConversationId!,
              message:
                "What project codename did I tell you earlier?",
            });

            return {
              intent: response.intent,
              status: response.status,
              answer: response.answer,
              citations: response.citations,
              expectedPhrase: "Amber Kestrel",
              phraseFound: response.answer
                .toLowerCase()
                .includes("amber kestrel"),
            };
          },
          (value) => {
            if (value.intent !== "RECALL") {
              return "Expected RECALL intent.";
            }

            if (!value.phraseFound) {
              return "The recalled answer did not contain Amber Kestrel.";
            }

            if (value.status === "insufficient_evidence") {
              return "Recall returned insufficient evidence.";
            }

            return null;
          },
        );
      }
    }

    // ============================================================
    // 4. Temporal verification
    // ============================================================

    if (selectedScenarios.has("04")) {
      if (directResearch) {
        await runScenario(
          "04 — Temporal verification",
          async () => {
            const snapshots =
              await infrastructure.memoryStore.researchSnapshots.findByConversation(
                directResearch!.conversationId,
              );

            if (snapshots.length === 0) {
              throw new Error(
                "Direct research did not persist a research snapshot.",
              );
            }

            const historicalSnapshot = snapshots[snapshots.length - 1];

            const result = await agent.verify({
              historicalSnapshotId: historicalSnapshot.id,
              conversationId: directResearch!.conversationId,
              question: historicalSnapshot.query,
            });

            return {
              historicalSnapshotId:
                result.verification.historicalSnapshotId,
              currentSnapshotId:
                result.verification.currentSnapshotId,
              status: result.verification.status,
              findings: result.verification.findings,
              comparisons: result.comparisons,

              // M6.5.3:
              // Expose deterministic structural metrics so temporal verification
              // cannot pass merely because two different snapshot IDs exist.
              comparisonCount: result.comparisons.length,
              findingCount: result.verification.findings.length,

              // M6.5.3:
              // Verify that the overall status is consistent with the individual
              // findings without making assumptions about real-world search results.
              expectedStatus:
                result.verification.findings.some(
                  (finding) => finding.status === "changed",
                )
                  ? "changed"
                  : result.verification.findings.length > 0 &&
                    result.verification.findings.every(
                      (finding) => finding.status === "unchanged",
                    )
                    ? "unchanged"
                    : "inconclusive",
            };
          },
          (value) => {
            if (!value.currentSnapshotId) {
              return "No current research snapshot was produced.";
            }

            if (!value.historicalSnapshotId) {
              return "No historical snapshot was used.";
            }

            if (
              value.historicalSnapshotId === value.currentSnapshotId
            ) {
              return "Historical and current snapshot IDs must differ.";
            }

            // M6.5.3:
            // Require actual comparison output, not merely distinct snapshot IDs.
            if (value.comparisonCount === 0) {
              return "Temporal verification produced no evidence comparisons.";
            }

            if (value.findingCount === 0) {
              return "Temporal verification produced no verification findings.";
            }

            // M6.5.3:
            // Ensure comparisons and findings remain structurally aligned.
            if (value.comparisonCount !== value.findingCount) {
              return "Comparison count and verification finding count do not match.";
            }

            // M6.5.3:
            // Ensure the aggregate verification status matches the individual findings.
            if (value.status !== value.expectedStatus) {
              return (
                `Verification status mismatch: expected ${value.expectedStatus}, ` +
                `received ${value.status}.`
              );
            }

            return null;
          },
        );
      } else {
        blockScenario(
          "04 — Temporal verification",
          "Direct research prerequisite failed its acceptance criteria; no valid historical snapshot is available.",
        );
      }
    }

    // ============================================================
    // 5. Insufficient evidence handling
    // ============================================================

    if (selectedScenarios.has("05")) {
      await runScenario(
        "05 — Insufficient evidence",
        async () => {
          const response = await agent.execute({
            message:
              "Research whether any publicly accessible source " +
              "contains the exact words written on the private note " +
              "currently underneath my keyboard. Do not guess.",
          });

          return {
            intent: response.intent,
            status: response.status,
            answer: response.answer,
            citations: response.citations,
            expectedStatus: "insufficient_evidence",
            statusMatched:
              response.status === "insufficient_evidence",
            citationCount: response.citations.length,
          };
        },
        (value) => {
          if (value.intent !== "RESEARCH") {
            return "Expected RESEARCH intent for an external-information question.";
          }

          if (value.status !== "insufficient_evidence") {
            return "Expected insufficient_evidence status.";
          }

          if (value.citations.length !== 0) {
            return "Insufficient-evidence response must not contain citations.";
          }

          const normalizedAnswer = value.answer
            .trim()
            .toLowerCase()
            .replace(/[_\s]+/g, " ");

          if (
            normalizedAnswer === "insufficient evidence" ||
            normalizedAnswer.length < 20
          ) {
            return "Insufficient-evidence answer is not a meaningful user-facing explanation.";
          }

          return null;
        },
      );
    }

    // ============================================================
    // Prerequisite execution notices
    // ============================================================

    const prerequisiteScenarios = [...executionScenarios].filter(
      (scenario) => !selectedScenarios.has(scenario),
    );

    if (prerequisiteScenarios.length > 0) {
      console.log(
        `\nPrerequisite scenarios executed: ${prerequisiteScenarios.join(", ")}`,
      );
    }
  } finally {
    try {
      agent.close();
    } finally {
      infrastructure.close();

      if (process.env.M6_KEEP_TEMP === "1") {
        console.log(
          `\n[Diagnostics] Temporary validation database retained at: ${temporaryDirectory}`,
        );
      } else {
        rmSync(temporaryDirectory, {
          recursive: true,
          force: true,
        });
      }
    }
  }

  // ==============================================================
  // Validation summary
  // ==============================================================

  const passed = results.filter(
    (item) => item.outcome === "passed",
  ).length;

  const failed = results.filter(
    (item) => item.outcome === "failed",
  ).length;

  const blocked = results.filter(
    (item) => item.outcome === "blocked",
  ).length;

  console.log("\n==========================================");
  console.log("VALIDATION SUMMARY");
  console.log("==========================================");

  console.log(
    JSON.stringify(
      {
        total: results.length,
        passed,
        failed,
        blocked,
        acceptancePassed: failed === 0 && blocked === 0,
        requestedScenarios: [...selectedScenarios],
        results,
      },
      null,
      2,
    ),
  );

  if (failed > 0 || blocked > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "Validation runner failed:",
    error instanceof Error ? error.stack : error,
  );

  process.exitCode = 1;
});