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
    // Callers pass server data that is not always the string the type says.
    const text = typeof content === "string" ? content : String(content ?? "")
    return (
        <Suspense fallback={<span className={className}>{stripHtmlTags(text)}</span>}>
            <MarkdownImpl content={text} className={className} />
        </Suspense>
    )
}

export default MarkdownRenderer
