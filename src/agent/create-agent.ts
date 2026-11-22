import { randomUUID } from "node:crypto";

import {
  createAgentInfrastructure,
  type AgentInfrastructure,
  type AgentInfrastructureConfig,
} from "./create-agent-infrastructure.js";

import { planRequest } from "./plan-request.js";
import { MemoryRetriever } from "./memory-retriever.js";
import { ResearchExecutor } from "./research-executor.js";
import { EvidenceAssembler } from "./evidence-assembler.js";
import { GroundedSynthesizer } from "./grounded-synthesizer.js";
import { HistoricalResearchRetriever } from "./historical-research-retriever.js";
import { FreshResearchVerifier } from "./fresh-research-verifier.js";
import { EvidenceComparisonEngine } from "./evidence-comparison-engine.js";

import {
  parseAgentExecutionRequest,
} from "./orchestration-schema.js";

import {
  parseVerificationRequest,
} from "./verification-schema.js";

import type {
  AgentExecutionRequest,
  AgentExecutionResult,
} from "./orchestration-types.js";

import type {
  IntentClassifier,
} from "./types.js";

import type {
  LLMProvider,
} from "../llm/llm-provider.js";

import type {
  Conversation,
  ConversationMessage,
  ResearchSnapshot,
  ResearchSnapshotSummary,
} from "../memory/types.js";

import type {
  VerificationRequest,
  VerificationResult,
  VerificationFinding,
  ComparisonResult,
  VerificationStatus,
} from "./verification-types.js";

import {
  createOllamaClient,
} from "../llm/create-ollama-provider.js";

import {
  OllamaIntentClassifier,
} from "../llm/ollama-intent-classifier.js";

export interface CreateAgentOptions {
  classifier?: IntentClassifier;
  llm?: LLMProvider;
  infrastructure?: AgentInfrastructure;
  infrastructureConfig?: AgentInfrastructureConfig;
  clock?: () => Date;
}

export class AgentPersistenceError extends Error {
  constructor(
    readonly operation: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AgentPersistenceError";
  }
}

function mapComparisonStatus(
  status: ComparisonResult["status"],
): VerificationStatus {
  switch (status) {
    case "unchanged":
      return "unchanged";

    case "changed":
      return "changed";

    case "historical_only":
    case "current_only":
    case "inconclusive":
      return "inconclusive";
  }
}

function deriveVerificationStatus(
  findings: VerificationFinding[],
): VerificationStatus {
  if (findings.some((finding) => finding.status === "changed")) {
    return "changed";
  }

  if (
    findings.length > 0 &&
    findings.every((finding) => finding.status === "unchanged")
  ) {
    return "unchanged";
  }

  return "inconclusive";
}

export function createAgent(options: CreateAgentOptions = {}) {
  const clock = options.clock ?? (() => new Date());

  const infrastructure =
    options.infrastructure ?? createAgentInfrastructure(
      options.infrastructureConfig,
    );

  const ownsInfrastructure = options.infrastructure === undefined;

  const llm = options.llm ?? createOllamaClient();

  const classifier =
    options.classifier ?? new OllamaIntentClassifier(llm);

  const memoryRetriever = new MemoryRetriever(
    infrastructure.memoryStore.search,
    clock,
  );

  const researchExecutor = new ResearchExecutor(
    infrastructure.searchService,
    clock,
  );

  const evidenceAssembler = new EvidenceAssembler(clock);

  const synthesizer = new GroundedSynthesizer(llm, clock);

  const historicalResearchRetriever = new HistoricalResearchRetriever(
    infrastructure.memoryStore.researchSnapshots,
  );

  const freshResearchVerifier = new FreshResearchVerifier(
    historicalResearchRetriever,
    researchExecutor,
  );

  const evidenceComparisonEngine = new EvidenceComparisonEngine(clock);

  async function persistConversation(
    conversation: Conversation,
  ): Promise<void> {
    try {
      await infrastructure.memoryStore.conversations.create(
        conversation,
      );
    } catch (error) {
      throw new AgentPersistenceError(
        "create_conversation",
        "Failed to create conversation.",
        { cause: error },
      );
    }
  }

  async function persistMessage(
    message: ConversationMessage,
  ): Promise<void> {
    try {
      await infrastructure.memoryStore.conversations.appendMessage(
        message,
      );
    } catch (error) {
      throw new AgentPersistenceError(
        "append_message",
        `Failed to persist ${message.role} message.`,
        { cause: error },
      );
    }
  }

  async function persistResearch(
    snapshot: ResearchSnapshot,
  ): Promise<void> {
    try {
      await infrastructure.memoryStore.researchSnapshots.save(
        snapshot,
      );
    } catch (error) {
      throw new AgentPersistenceError(
        "save_research_snapshot",
        "Failed to persist research snapshot.",
        { cause: error },
      );
    }
  }

  async function persistVerificationBundle(
    comparisons: ComparisonResult[],
    verification: VerificationResult,
  ): Promise<void> {
    try {
      await infrastructure.verificationRepository.saveVerificationBundle(
        comparisons,
        verification,
      );
    } catch (error) {
      throw new AgentPersistenceError(
        "save_verification_bundle",
        "Failed to persist verification bundle.",
        { cause: error },
      );
    }
  }

  return {
    async plan(message: string) {
      return planRequest(message, classifier);
    },

    // M7.4: Conversation history listing
    async listConversations(limit = 50) {
      try {
        return await infrastructure.memoryStore.conversations.list(
          limit,
        );
      } catch (error) {
        throw new AgentPersistenceError(
          "list_conversations",
          "Failed to retrieve conversation history.",
          { cause: error },
        );
      }
    },

    // M7.7.3: Historical research snapshot listing
    async listResearchSnapshots(
      limit = 50,
    ): Promise<ResearchSnapshotSummary[]> {
      try {
        return await infrastructure.memoryStore.researchSnapshots.list(
          limit,
        );
      } catch (error) {
        throw new AgentPersistenceError(
          "list_research_snapshots",
          "Failed to retrieve research snapshots.",
          { cause: error },
        );
      }
    },

    // M7.4: Retrieve one conversation and its messages
    async getConversation(id: string): Promise<{
      conversation: Conversation;
      messages: ConversationMessage[];
    } | null> {
      try {
        const conversation =
          await infrastructure.memoryStore.conversations.findById(id);

        if (!conversation) {
          return null;
        }

        const messages =
          await infrastructure.memoryStore.conversations.getMessages(
            id,
          );

        return {
          conversation,
          messages,
        };
      } catch (error) {
        throw new AgentPersistenceError(
          "get_conversation",
          "Failed to retrieve conversation.",
          { cause: error },
        );
      }
    },

    async execute(
      request: AgentExecutionRequest,
    ): Promise<AgentExecutionResult> {
      let validatedRequest: ReturnType<typeof parseAgentExecutionRequest>;

      try {
        validatedRequest = parseAgentExecutionRequest(request);
      } catch (error) {
        throw new Error(
          "Agent execution request is invalid.",
          { cause: error },
        );
      }

      const message = validatedRequest.message;
      const now = clock().toISOString();

      const conversationId =
        validatedRequest.conversationId ?? randomUUID();

      if (validatedRequest.conversationId) {
        let existingConversation: Conversation | null;

        try {
          existingConversation =
            await infrastructure.memoryStore.conversations.findById(
              conversationId,
            );
        } catch (error) {
          throw new AgentPersistenceError(
            "find_conversation",
            "Failed to retrieve existing conversation.",
            { cause: error },
          );
        }

        if (!existingConversation) {
          throw new Error(
            `Conversation '${conversationId}' does not exist.`,
          );
        }
      } else {
        await persistConversation({
          id: conversationId,
          title: message.slice(0, 200),
          createdAt: now,
          updatedAt: now,
        });
      }

      const plan = await planRequest(message, classifier);

      const memory = plan.requiresMemory
        ? await memoryRetriever.retrieve(message)
        : null;

      await persistMessage({
        id: randomUUID(),
        conversationId,
        role: "user",
        content: message,
        createdAt: clock().toISOString(),
      });

      const research = await researchExecutor.execute(
        message,
        plan,
      );

      if (research) {
        await persistResearch({
          id: randomUUID(),
          conversationId,
          query: research.query,
          provider: research.provider,
          searchedAt: research.searchedAt,
          recordedAt: clock().toISOString(),
          results: research.results,
        });
      }

      const evidence = evidenceAssembler.assemble(
        memory,
        research,
      );

      const response = await synthesizer.synthesize({
        question: message,
        intent: plan.intent,
        evidence,
      });

      await persistMessage({
        id: randomUUID(),
        conversationId,
        role: "assistant",
        content: response.answer,
        createdAt: response.generatedAt,
      });

      return {
        ...response,
        conversationId,
      };
    },

    async verify(
      request: VerificationRequest,
    ): Promise<{
      verification: VerificationResult;
      comparisons: ComparisonResult[];
    }> {
      const validatedRequest = parseVerificationRequest(request);

      const { historical, current } =
        await freshResearchVerifier.verify(validatedRequest);

      const conversationId =
        validatedRequest.conversationId ?? historical.conversationId;

      const currentSnapshot: ResearchSnapshot = {
        id: randomUUID(),
        ...(conversationId ? { conversationId } : {}),
        query: current.query,
        provider: current.provider,
        searchedAt: current.searchedAt,
        recordedAt: clock().toISOString(),
        results: current.results,
      };

      // Persist fresh research before creating records that reference it.
      await persistResearch(currentSnapshot);

      const comparisons = evidenceComparisonEngine.compare(
        historical,
        currentSnapshot,
      );

      const claim = (
        validatedRequest.question ?? historical.query
      ).slice(0, 10000);

      const findings: VerificationFinding[] = comparisons.map(
        (comparison) => ({
          id: randomUUID(),
          claim,
          status: mapComparisonStatus(comparison.status),
          explanation: comparison.explanation,
          historicalEvidenceIds: comparison.historicalEvidenceIds,
          currentEvidenceIds: comparison.currentEvidenceIds,
        }),
      );

      if (findings.length === 0) {
        findings.push({
          id: randomUUID(),
          claim,
          status: "inconclusive",
          explanation:
            "No comparable evidence was returned by the historical and fresh research snapshots.",
          historicalEvidenceIds: [],
          currentEvidenceIds: [],
        });
      }

      const verification: VerificationResult = {
        id: randomUUID(),
        historicalSnapshotId: historical.id,
        currentSnapshotId: currentSnapshot.id,
        ...(conversationId ? { conversationId } : {}),
        query: historical.query,
        status: deriveVerificationStatus(findings),
        findings,
        verifiedAt: clock().toISOString(),
      };

      await persistVerificationBundle(
        comparisons,
        verification,
      );

      return {
        verification,
        comparisons,
      };
    },

    close() {
      if (ownsInfrastructure) {
        infrastructure.close();
      }
    },
  };
}