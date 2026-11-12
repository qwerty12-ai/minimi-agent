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

import { parseAgentExecutionRequest } from "./orchestration-schema.js";

import type {
  AgentExecutionRequest,
  AgentExecutionResult,
} from "./orchestration-types.js";

import type { IntentClassifier } from "./types.js";
import type { LLMProvider } from "../llm/llm-provider.js";

import type {
  Conversation,
  ConversationMessage,
  ResearchSnapshot,
} from "../memory/types.js";

import { createOllamaClient } from "../llm/create-ollama-provider.js";
import { OllamaIntentClassifier } from "../llm/ollama-intent-classifier.js";

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

  return {
    async plan(message: string) {
      return planRequest(message, classifier);
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

    close() {
      if (ownsInfrastructure) {
        infrastructure.close();
      }
    },
  };
}