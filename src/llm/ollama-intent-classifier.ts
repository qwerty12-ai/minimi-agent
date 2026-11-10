import type {
  IntentClassifier,
  ClassificationInput,
  IntentClassification,
} from "../agent/types.js";

import type { LLMProvider } from "./llm-provider.js";

import {
  parseIntentClassification,
} from "../agent/intent-schema.js";

const INTENT_FORMAT_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: [
        "RECALL",
        "RESEARCH",
        "VERIFY",
        "COMPARE",
      ],
    },
  },
  required: ["intent"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `
You are an intent classifier for a conversational research agent.

Classify the user's message into exactly one intent:

RECALL:
Retrieve historical conversation information.

RESEARCH:
Find new information using web search.

VERIFY:
Retrieve a previous claim and check it against current evidence.

COMPARE:
Retrieve historical information and compare it with current information.

Rules:
- Return only valid JSON.
- Return exactly one object.
- The object must contain only the intent field.
- Never invent historical information.
- Do not include explanations.
`;

export class OllamaIntentClassifier
  implements IntentClassifier {

  constructor(
    private readonly llm: LLMProvider
  ) {}

  async classify(
    input: ClassificationInput
  ): Promise<IntentClassification> {

    const response = await this.llm.generateStructured({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: input.message,
        },
      ],

      format: INTENT_FORMAT_SCHEMA,
      temperature: 0,
      think: false,
    });

    return parseIntentClassification(response);
  }
}