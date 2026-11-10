export type LLMRole = "system" | "user" | "assistant"

export interface LLMMessage {
    role: LLMRole;
    content: string;
}

export interface StructuredGenerationRequest {
    messages: LLMMessage[];
    format: Record<string, unknown>;
    temperature?: number;
    think?: boolean;
}

export interface LLMProvider {
    generateStructured(request: StructuredGenerationRequest): Promise<unknown>;
}