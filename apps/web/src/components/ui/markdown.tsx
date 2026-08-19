import React, { Suspense, lazy } from 'react'

interface MarkdownRendererProps {
    content: string,
    className?: string
}

/**
 * The markdown stack (react-markdown + remark-gfm + rehype-raw, which drags in
 * a full HTML parser) is ~400 kB raw / ~120 kB gzipped — and error-banner's
 * static import put ALL of it on the boot path, to render error messages that
 * are rare and mostly plain text. So the real renderer lives in markdown-impl
 * and loads lazily on first actual render.
 *
 * The fallback is the content with HTML tags STRIPPED: the content is often
 * server HTML (Frappe _server_messages), which the real renderer displays via
 * rehype-raw — shown raw for the load moment it would read as broken markup,
 * not text. Stripped plain text is a readable stand-in until the chunk lands.
 */
const MarkdownImpl = lazy(() => import('./markdown-impl'))

const stripHtmlTags = (text: string) => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
    return (
        <Suspense fallback={<span className={className}>{stripHtmlTags(content)}</span>}>
            <MarkdownImpl content={content} className={className} />
        </Suspense>
    )
}

export default MarkdownRenderer
