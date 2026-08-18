import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"

/** Lines shown when a long block is collapsed. */
const COLLAPSED_LINES = 15
/** Only collapse beyond this, so we never add a toggle to hide a line or two. */
const COLLAPSE_AT = 20

/**
 * A fenced code block: line-number gutter + scrollable code, with a hover-
 * revealed toolbar (language · collapse · copy) in the top-right corner —
 * matching Gameplan/frappe-ui. RichTextRenderer swaps `<pre><code>` for this.
 *
 * Highlighting is applied client-side (the stored HTML has only raw text — the
 * editor's token spans are view-only decorations). We load the highlighter
 * lazily so highlight.js stays out of the main bundle; until it resolves the
 * code renders as plain (escaped) text, then upgrades in place.
 *
 * Long blocks collapse to ~COLLAPSED_LINES with a fade (rather than a nested
 * scrollbar — that traps scroll, especially on touch and inside the virtualized
 * stream; the copy button covers "select it all").
 */
export const CodeBlock = ({ code, language }: { code: string; language?: string }) => {
    const [result, setResult] = useState<{ value: string; language?: string } | null>(null)
    const [copied, setCopied] = useState(false)
    const [expanded, setExpanded] = useState(false)

    const lineCount = useMemo(() => code.split("\n").length, [code])
    const collapsible = lineCount > COLLAPSE_AT
    const collapsed = collapsible && !expanded

    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        let active = true
        import("@lib/highlight").then(({ highlightCode }) => {
            if (active) setResult(highlightCode(code, language))
        })
        return () => {
            active = false
        }
    }, [code, language])

    const copy = () => {
        navigator.clipboard?.writeText(code).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        })
    }

    const toggle = () => {
        // Collapsing: anchor the MESSAGE top to the viewport top FIRST (while still
        // expanded), THEN shrink — every collapsing line is below that anchor, so
        // there's no jump and nothing for the stream's scroll compensation to fight.
        // Instant, not smooth: animating a 200-line scroll felt jarring.
        if (expanded) {
            const anchor = containerRef.current?.closest("[data-message-id]") ?? containerRef.current
            anchor?.scrollIntoView({ block: "start" })
        }
        setExpanded((value) => !value)
    }

    const displayLanguage = language || result?.language || _("Code")

    return (
        <div ref={containerRef} className="code-block group">
            <pre
                className={collapsed ? "overflow-y-hidden" : undefined}
                style={collapsed ? { maxHeight: `calc(${COLLAPSED_LINES}lh + 1.5rem)` } : undefined}
            >
                {/* Line-number gutter — aligns 1:1 with code lines (shared line-height,
                    no wrap). Horizontal scroll lives on <code>, so the gutter stays put. */}
                <span
                    aria-hidden="true"
                    className="flex flex-none select-none flex-col text-right tabular-nums items-end border-r border-outline-gray-2 pr-3 text-ink-gray-4"
                >
                    {Array.from({ length: lineCount }, (_unused, index) => (
                        <span key={index} className="block">
                            {index + 1}
                        </span>
                    ))}
                </span>

                {result !== null ? (
                    <code className="hljs" dangerouslySetInnerHTML={{ __html: result.value }} />
                ) : (
                    <code>{code}</code>
                )}
            </pre>

            {/* Hover-revealed toolbar (top-right): language · collapse · copy. Always
                shown on touch (no hover). Sits on an opaque code-bg patch so it never
                bleeds over the code beneath it. */}
            <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-(--code-bg) p-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                <span className="select-none px-1 text-sm text-ink-gray-4">{displayLanguage}</span>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            theme="gray"
                            size="sm"
                            isIconButton
                            onClick={copy}
                            aria-label={_("Copy code")}
                        >
                            {copied ? <Check /> : <Copy />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">{_("Copy code")}</TooltipContent>
                </Tooltip>

            </div>

            {/* The faded area is a click target — users expect clicking the faded
                lines to expand, not just the chevron. Visual fade and click
                target are SEPARATE layers: the gradient's top half is nearly
                transparent, and a click surface reaching that high puts the
                pointer/I-beam boundary in the middle of readable text — the
                cursor flips back and forth with no visible reason. So the
                gradient stays tall (and holds solid for its lower stretch),
                while the click strip only covers the part where text is
                clearly obscured. The chevron button below stays as the visible
                and keyboard/screen-reader control, so this surface is a plain
                div: a second button would duplicate the announcement. */}
            {collapsed && (
                <>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(to_top,var(--code-bg)_40%,transparent)]" />
                    {/* Hovering the strip reveals a centered "Show more" pill, so the
                        pointer cursor has a visible explanation. Hidden on touch (no
                        hover) — the chevron is always shown there instead. */}
                    <div
                        onClick={toggle}
                        className="group/fade absolute inset-x-0 bottom-0 flex h-10 cursor-pointer items-end justify-center pb-1.5"
                    >
                        {/* One surface step above the code well in each mode (the well
                            is surface-gray-1 light / surface-gray-2 dark). */}
                        <span className="pointer-events-none select-none rounded-full border border-outline-gray-2 bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-6 opacity-0 transition-opacity group-hover/fade:opacity-100 dark:bg-surface-gray-3">
                            {_("Show more")}
                        </span>
                    </div>
                </>
            )}

            {collapsible && (
                <div className="absolute right-1.5 bottom-1.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                theme="gray"
                                size="sm"
                                isIconButton
                                onClick={toggle}
                                aria-label={expanded ? _("Collapse") : _("Expand")}
                            >
                                {expanded ? <ChevronUp /> : <ChevronDown />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">{expanded ? _("Collapse") : _("Expand")}</TooltipContent>
                    </Tooltip>

                </div>
            )}
        </div>
    )
}

export default CodeBlock
