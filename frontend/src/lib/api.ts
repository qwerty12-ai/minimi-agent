export interface AgentCitation {
  evidenceId: string
}

export interface AgentResponse {
  answer: string
  intent: string
  status: 'supported' | 'partially_supported' | 'insufficient_evidence'
  citations: AgentCitation[]
  generatedAt: string
  conversationId: string
}

export interface AgentExecutionRequest {
  message: string
  conversationId?: string
}

export interface Conversation {
  id: string
  title?: string
  createdAt: string
  updatedAt: string
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  createdAt: string
}

export interface ConversationHistoryResponse {
  conversation: Conversation
  messages: ConversationMessage[]
}

export interface ConversationListResponse {
  conversations: Conversation[]
}

async function handleApiError(
  response: Response,
  fallback: string,
): Promise<never> {
  const payload = await response.json().catch(() => null)

  throw new Error(
    payload?.message ?? `${fallback} (${response.status})`,
  )
}

export async function executeAgent(
  request: AgentExecutionRequest,
): Promise<AgentResponse> {
  const response = await fetch('/api/agent/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    await handleApiError(response, 'Agent request failed')
  }

  return response.json() as Promise<AgentResponse>
}

export async function getConversations(
  limit = 50,
): Promise<ConversationListResponse> {
  const response = await fetch(
    `/api/conversations?limit=${limit}`,
  )

  if (!response.ok) {
    await handleApiError(
      response,
      'Conversation history request failed',
    )
  }

  return response.json() as Promise<ConversationListResponse>
}

export async function getConversation(
  id: string,
): Promise<ConversationHistoryResponse> {
  const response = await fetch(
    `/api/conversations/${encodeURIComponent(id)}`,
  )

  if (!response.ok) {
    await handleApiError(
      response,
      'Conversation retrieval failed',
    )
  }

  return response.json() as Promise<ConversationHistoryResponse>
}