import ReactMarkdown from 'react-markdown'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

// 代码块组件（带复制按钮）
function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-3">
      {language && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--fill-tertiary)] rounded-t-xl text-xs text-[var(--text-secondary)]">
          <span>{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 py-0.5 px-2 rounded-lg hover:bg-black/5 transition-colors"
          >
            {copied ? <Check size={12} className="text-[#34C759]" /> : <Copy size={12} />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
      )}
      <pre className={`bg-[#1C1C1E] text-[#F2F2F7] p-4 overflow-x-auto text-xs leading-relaxed ${language ? 'rounded-b-xl' : 'rounded-xl'}`}>
        <code>{children}</code>
      </pre>
    </div>
  )
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm max-w-none text-[var(--text-primary)] ${className}`}>
      <ReactMarkdown
        components={{
          // 标题
          h1: ({ children, ...props }) => <h1 className="text-lg font-bold mt-4 mb-2 first:mt-0" {...props}>{children}</h1>,
          h2: ({ children, ...props }) => <h2 className="text-base font-semibold mt-3 mb-1.5 first:mt-0" {...props}>{children}</h2>,
          h3: ({ children, ...props }) => <h3 className="text-sm font-semibold mt-3 mb-1 first:mt-0" {...props}>{children}</h3>,
          // 段落
          p: ({ children, ...props }) => <p className="my-1.5 leading-relaxed text-sm first:mt-0" {...props}>{children}</p>,
          // 列表
          ul: ({ children, ...props }) => <ul className="my-1.5 pl-5 list-disc space-y-0.5" {...props}>{children}</ul>,
          ol: ({ children, ...props }) => <ol className="my-1.5 pl-5 list-decimal space-y-0.5" {...props}>{children}</ol>,
          li: ({ children, ...props }) => <li className="text-sm leading-relaxed" {...props}>{children}</li>,
          // 粗体/斜体
          strong: ({ children, ...props }) => <strong className="font-semibold text-[var(--text-primary)]" {...props}>{children}</strong>,
          em: ({ children, ...props }) => <em className="italic" {...props}>{children}</em>,
          // 引用
          blockquote: ({ children, ...props }) => (
            <blockquote className="border-l-2 border-[#007AFF] pl-3 my-2 text-[var(--text-secondary)] italic" {...props}>
              {children}
            </blockquote>
          ),
          // 链接
          a: ({ children, href, ...props }) => (
            <a href={href} className="text-[#007AFF] hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          // 行内代码
          code: ({ children, className, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '')
            if (match) {
              return <CodeBlock language={match[1]}>{String(children)}</CodeBlock>
            }
            return (
              <code className="px-1.5 py-0.5 bg-[var(--fill-tertiary)] rounded-md text-xs font-mono text-[#FF9500]" {...props}>
                {children}
              </code>
            )
          },
          // 分割线
          hr: (props) => <hr className="my-3 border-[var(--separator)]" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
