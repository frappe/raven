interface SearchTextRendererProps {
	content: string
}

/** Splits an FTS snippet on its `<mark>` spans: even parts are text, odd parts are matches. */
const splitOnMarks = (content: string) => content.split(/<mark>([\s\S]*?)<\/mark>/g)

/**
 * The `<mark>…</mark>` spans of an FTS snippet as highlighted nodes, and nothing else — no
 * wrapper, so a caller can put them in whatever element it already has (a truncating
 * heading, a paragraph). React escapes the surrounding text, so the snippet is never
 * treated as markup beyond the marks this recognises.
 */
export const SearchHighlightedText = ({ content }: SearchTextRendererProps) => (
	<>
		{splitOnMarks(content).map((part, i) =>
			i % 2 === 1
				? <mark key={i} className="bg-surface-amber-2 text-ink-gray-8 rounded-sm px-0.5 font-semibold">{part}</mark>
				: <span key={i}>{part}</span>
		)}
	</>
)

/**
 * The snippet without its highlight markup, for places that need the plain string rather
 * than nodes — an `alt` attribute, or parsing a file extension off a filename.
 */
export const stripSearchHighlights = (content: string): string =>
	content.replace(/<\/?mark>/g, '')

/**
 * Plain-text renderer for sqlite FTS search results. Recognizes `<mark>…</mark>`
 * spans from FTS snippet output and styles them as amber highlights; React
 * escapes everything else.
 *
 */
export const SearchTextRenderer = ({ content }: SearchTextRendererProps) => {
	return (
		<div className="text-p-base text-ink-gray-8 whitespace-pre-wrap wrap-break-words">
			<SearchHighlightedText content={content} />
		</div>
	)
}

export default SearchTextRenderer
