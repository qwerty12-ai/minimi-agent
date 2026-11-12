import { createAgentInfrastructure, type AgentInfrastructure, type AgentInfrastructureConfig } from "./create-agent-infrastructure.js";
import { planRequest } from "./plan-request.js";
import { MemoryRetriever } from "./memory-retriever.js";
import { ResearchExecutor } from "./research-executor.js";
import { EvidenceAssembler } from "./evidence-assembler.js";
import { GroundedSynthesizer } from "./grounded-synthesizer.js";

import { parseAgentExecutionRequest } from "./orchestration-schema.js";

import type {
  AgentExecutionRequest,
  AgentResponse,
} from "./orchestration-types.js";

import type { IntentClassifier } from "./types.js";
import type { LLMProvider } from "../llm/llm-provider.js";

import { createOllamaClient } from "../llm/create-ollama-provider.js";
import { OllamaIntentClassifier } from "../llm/ollama-intent-classifier.js";

export interface CreateAgentOptions {
  classifier?: IntentClassifier;
  llm?: LLMProvider;
  infrastructure?: AgentInfrastructure;
  infrastructureConfig?: AgentInfrastructureConfig;
  clock?: () => Date;
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

  return {
    async plan(message: string) {
      return planRequest(message, classifier);
    },

    async execute(
      request: AgentExecutionRequest,
    ): Promise<AgentResponse> {
      let validatedRequest: AgentExecutionRequest;

      try {
        parseAgentExecutionRequest(request);
        validatedRequest = request;
      } catch (error) {
        throw new Error(
          "Agent execution request is invalid.",
          { cause: error },
        );
      }

      const message = validatedRequest.message.trim();

      const plan = await planRequest(message, classifier);

      const memory = plan.requiresMemory
        ? await memoryRetriever.retrieve(message)
        : null;

      const research = await researchExecutor.execute(
        message,
        plan,
      );

      const evidence = evidenceAssembler.assemble(
        memory,
        research,
      );

      return synthesizer.synthesize({
        question: message,
        intent: plan.intent,
        evidence,
      });
    },

    close() {
      if (ownsInfrastructure) {
        infrastructure.close();
      }
    },
  };
}