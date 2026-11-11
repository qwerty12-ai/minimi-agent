import type { SearchResult } from "../research/types.js";

export type ConversationRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

export interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationRole;
  content: string;
  createdAt: string;
}

export type MemoryKind =
  | "fact"
  | "preference"
  | "decision"
  | "context";

export type MemorySourceType =
  | "conversation"
  | "research";

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  content: string;
  sourceType: MemorySourceType;
  sourceId: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchSnapshot {
  id: string;
  conversationId?: string;
  query: string;
  provider: string;
  searchedAt: string;
  recordedAt: string;
  results: SearchResult[];
}

export interface ConversationRepository {
  create(conversation: Conversation): Promise<void>;

  findById(id: string): Promise<Conversation | null>;

  appendMessage(message: ConversationMessage): Promise<void>;

  getMessages(
    conversationId: string
  ): Promise<ConversationMessage[]>;
}

export interface MemoryRepository {
  save(memory: MemoryRecord): Promise<void>;

  findById(id: string): Promise<MemoryRecord | null>;

  findBySource(
    sourceType: MemorySourceType,
    sourceId: string
  ): Promise<MemoryRecord[]>;
}

export interface ResearchSnapshotRepository {
  save(snapshot: ResearchSnapshot): Promise<void>;

  findById(id: string): Promise<ResearchSnapshot | null>;

  findByConversation(
    conversationId: string
  ): Promise<ResearchSnapshot[]>;
}