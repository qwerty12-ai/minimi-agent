import { z } from "zod";
import { SearchResultSchema } from "../research/search-schema.js";

export const ConversationRoleSchema = z.enum([
  "system",
  "user",
  "assistant",
  "tool",
]);

export const ConversationSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const ConversationMessageSchema = z.object({
  id: z.string().trim().min(1).max(200),
  conversationId: z.string().trim().min(1).max(200),
  role: ConversationRoleSchema,
  content: z.string().max(100000),
  createdAt: z.string().datetime(),
}).strict();

export const MemoryKindSchema = z.enum([
  "fact",
  "preference",
  "decision",
  "context",
]);

export const MemorySourceTypeSchema = z.enum([
  "conversation",
  "research",
]);

export const MemoryRecordSchema = z.object({
  id: z.string().trim().min(1).max(200),
  kind: MemoryKindSchema,
  content: z.string().trim().min(1).max(10000),
  sourceType: MemorySourceTypeSchema,
  sourceId: z.string().trim().min(1).max(200),
  confidence: z.number().finite().min(0).max(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export const ResearchSnapshotSchema = z.object({
  id: z.string().trim().min(1).max(200),
  conversationId: z.string().trim().min(1).max(200).optional(),
  query: z.string().trim().min(1).max(500),
  provider: z.string().trim().min(1).max(200),
  searchedAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
  results: z.array(SearchResultSchema).max(100),
}).strict();

export function parseConversation(value: unknown) {
  return ConversationSchema.parse(value);
}

export function parseConversationMessage(value: unknown) {
  return ConversationMessageSchema.parse(value);
}

export function parseMemoryRecord(value: unknown) {
  return MemoryRecordSchema.parse(value);
}

export function parseResearchSnapshot(value: unknown) {
  return ResearchSnapshotSchema.parse(value);
}