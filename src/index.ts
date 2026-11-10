export {createAgent} from "./agent/create-agent.js";
export { planRequest } from "./agent/plan-request.js";
export { getOllamaConfig } from "./config/ollama.js";
export { OllamaIntentClassifier } from "./llm/ollama-intent-classifier.js";
export { OllamaClient } from "./llm/ollama-client.js";
export type {
  Intent,
  ExecutionPlan,
  ExecutionRequirements,
  IntentClassifier
} from "./agent/types.js"

import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = buildApp();

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
