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
    const payload = await response.json().catch(() => null)

    throw new Error(
      payload?.message ?? `Agent request failed (${response.status})`,
    )
  }

  return response.json() as Promise<AgentResponse>
}