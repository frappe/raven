import React from 'react'
import rehypeRaw from 'rehype-raw'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
    content: string,
    className?: string
}

/** The real renderer. Loaded lazily by markdown.tsx — import THAT, not this. */
const MarkdownImpl: React.FC<MarkdownRendererProps> = ({ content }) => {
    return <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
    >
        {content}
    </ReactMarkdown>
}

export default MarkdownImpl
