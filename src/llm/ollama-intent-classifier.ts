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

Classify the user's message into exactly one intent.

INTENT DEFINITIONS:

RECALL:
Use when the user wants information previously shared, discussed,
decided, named, preferred, or asked in an earlier conversation
or earlier message in the current conversation.

Examples:
- "What project codename did I tell you earlier?"
- "What database did we choose?"
- "What did I ask you about PostgreSQL?"

RESEARCH:
Use when the user wants new information, facts, explanations,
investigation, or comparisons that can be answered using newly
retrieved external information.

This includes:
- Comparing two or more technologies, products, companies, or subjects.
- Comparing their features, capabilities, release approaches, or pricing.
- Researching current or latest information.
- Questions about unknown real-world facts.
- Questions about private or physically observable information
  that is not available in conversation.

Examples:
- "Compare Node.js and Deno."
- "Compare the official TypeScript support of Node.js and Deno."
- "Which database is faster, PostgreSQL or MySQL?"
- "Research the current stable release of Node.js."
- "What words are written on the note under my keyboard?"

IMPORTANT:
A request to compare two subjects using newly researched information
is RESEARCH, not COMPARE.

If external sources cannot establish an answer, the agent must
report insufficient evidence rather than invent information.

VERIFY:
Use when the user wants a previously researched claim or saved
research snapshot checked against fresh evidence.

Examples:
- "Check whether the release information you found earlier is still correct."
- "Verify our previous research about this API against current sources."

COMPARE:
Use when the user wants historical conversational information
or a previously stored value compared with current information
obtained through research.

Examples:
- "Compare the product price I previously mentioned with its current price."
- "Compare the database choice we discussed earlier with the latest options."

IMPORTANT:
COMPARE requires historical conversational information as one side
of the comparison.

Do not use COMPARE merely because:
- The message contains the word "compare".
- The user mentions two technologies or products.
- The user asks for a comparison of current external facts.

DECISION PRIORITY:

1. If the user asks to retrieve something previously said or shared,
   classify as RECALL.
2. If the user asks to check a previously researched claim against
   fresh evidence, classify as VERIFY.
3. If the user asks to compare a historical conversational value
   with current researched information, classify as COMPARE.
4. Otherwise, if the user asks for new external information,
   explanations, facts, or comparisons, classify as RESEARCH.

Do not classify a question as RECALL merely because it uses "my"
or refers to something near the user.

RULES:
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