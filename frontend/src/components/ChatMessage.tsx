import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage as ChatMessageType } from './types'

interface ChatMessageProps {
  message: ChatMessageType
}

function ChatMessage({ message }: ChatMessageProps) {
  return (
    <article className="mb-10 flex items-start gap-4">
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-semibold ${
          message.role === 'assistant'
            ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
            : 'bg-[#292a35] text-gray-300'
        }`}
      >
        {message.role === 'assistant' ? 'M' : 'Y'}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-3 text-xs font-semibold text-gray-300">
          {message.role === 'assistant' ? 'MiniMi' : 'You'}
        </div>

        {message.role === 'user' ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-100">
            {message.content}
          </div>
        ) : (
          <div className="markdown-content break-words text-sm leading-7 text-gray-300">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-4 mt-7 text-2xl font-semibold text-white">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-3 mt-7 text-xl font-semibold text-white">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-3 mt-5 text-lg font-semibold text-gray-100">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="mb-2 mt-4 font-semibold text-gray-100">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="mb-4 leading-7">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-4 list-disc space-y-2 pl-6">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-4 list-decimal space-y-2 pl-6">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="pl-1 leading-7">{children}</li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-5 border-l-2 border-violet-500 bg-[#171923] py-3 pl-4 pr-3 text-gray-400">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-300 underline decoration-violet-400/40 underline-offset-4 hover:text-violet-200"
                  >
                    {children}
                  </a>
                ),
                code: ({ className, children }) => {
                  const isBlock = Boolean(className)

                  return isBlock ? (
                    <code className={className}>{children}</code>
                  ) : (
                    <code className="rounded-md border border-[#343541] bg-[#252630] px-1.5 py-0.5 font-mono text-[0.85em] text-violet-200">
                      {children}
                    </code>
                  )
                },
                pre: ({ children }) => (
                  <pre className="my-5 overflow-x-auto rounded-xl border border-[#30333d] bg-[#14151b] p-4 text-xs leading-6">
                    {children}
                  </pre>
                ),
                table: ({ children }) => (
                  <div className="my-5 overflow-x-auto rounded-xl border border-[#343541]">
                    <table className="w-full border-collapse text-left text-xs">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-[#242630] text-gray-100">
                    {children}
                  </thead>
                ),
                th: ({ children }) => (
                  <th className="border-b border-[#343541] px-4 py-3 font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-[#30333d] px-4 py-3 align-top text-gray-300">
                    {children}
                  </td>
                ),
                hr: () => <hr className="my-7 border-[#30333d]" />,
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-100">
                    {children}
                  </strong>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {message.response && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
            <span
              className={`rounded-md border px-2 py-1 capitalize ${
                message.response.status === 'supported'
                  ? 'border-emerald-900 bg-emerald-950/40 text-emerald-400'
                  : message.response.status === 'partially_supported'
                    ? 'border-amber-900 bg-amber-950/30 text-amber-400'
                    : 'border-[#353641] bg-[#20212a] text-gray-400'
              }`}
            >
              {message.response.status.replaceAll('_', ' ')}
            </span>

            <span>{message.response.citations.length} citations</span>

            <span className="border-l border-[#30333c] pl-2">
              {message.response.intent.replaceAll('_', ' ')}
            </span>
          </div>
        )}
      </div>
    </article>
  )
}

export default ChatMessage