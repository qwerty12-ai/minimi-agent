import ChatMessage from './ChatMessage'
import LoadingIndicator from './LoadingIndicator'
import type { ChatMessage as ChatMessageType } from './types'

interface MessageListProps {
  messages: ChatMessageType[]
  loading: boolean
}

function MessageList({ messages, loading }: MessageListProps) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      {messages.map((chatMessage) => (
        <ChatMessage
          key={chatMessage.id}
          message={chatMessage}
        />
      ))}

      {loading && <LoadingIndicator />}
    </div>
  )
}

export default MessageList