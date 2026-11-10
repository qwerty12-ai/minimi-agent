import {z} from "zod";
import { INTENTS } from "./types.js";

export const IntentClassificationSchema = z.object({
    intent: z.enum(INTENTS)
}).strict()

export type ValidatedIntentClassification = z.infer<typeof IntentClassificationSchema>;

export function parseIntentClassification(value: unknown): ValidatedIntentClassification {
    return IntentClassificationSchema.parse(value);
}