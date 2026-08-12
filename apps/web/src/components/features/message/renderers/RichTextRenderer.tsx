import { useMemo, useState } from "react"
import { Element, Text, domToReact, htmlToDOM, type DOMNode, type HTMLReactParserOptions } from "html-react-parser"
import { UserMention, ChannelMention } from "./MessageMention"
import { CodeBlock } from "./MessageCodeBlock"
import { MessageLink } from "./LinkPreviewCard"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/**
 * Renders a message body from the HTML the backend stores in `message.text`
 * (Tiptap's `getHTML()` output). We render HTML directly — NOT through a Tiptap
 * editor instance. The performance guide's core advice is to never mount an
 * editor you don't need, and a virtualized stream would otherwise spin up one
 * ProseMirror instance per row. `html-react-parser` builds React elements, so
 * `<script>` never executes and inline `on*=` handlers never bind; the only
 * residual vector is anchor href schemes, which we sanitize below.
 *
 * Output is wrapped in `.tiptap` — the SAME class Tiptap puts on its editor
 * root — so reading and editing share one stylesheet (see styles/rich-text.css).
 */

/** Schemes safe to keep on an <a href>. Everything else (javascript:, data:) is dropped. */
const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i

/** Custom-emoji image src: same-origin (relative) or http(s) only — never data:/js:. */
const SAFE_IMG_SRC = /^(https?:|\/)/i

/** Visible text of a node, minus a leading @/# — the fallback mention label. */
const mentionLabel = (node: Element): string =>
    node.children
        .map((child) => (child as { data?: string }).data ?? "")
        .join("")
        .replace(/^[@#]/, "")
        .trim()

/** Spoiler: hidden behind a block until clicked (keyboard-accessible). */
const Spoiler = ({ children }: { children: React.ReactNode }) => {
    const [revealed, setRevealed] = useState(false)
    return (
        <span
            className={cn("message-spoiler", revealed && "message-spoiler--revealed")}
            role="button"
            tabIndex={revealed ? -1 : 0}
            aria-label={revealed ? undefined : _("Spoiler — click to reveal")}
            onClick={() => !revealed && setRevealed(true)}
            onKeyDown={(e) => {
                if (!revealed && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault()
                    setRevealed(true)
                }
            }}
        >
            {children}
        </span>
    )
}

/** Recursively concatenate a node's text content (for code-block bodies). */
const textContent = (node: DOMNode): string => {
    if ((node as { type?: string }).type === "text") return (node as { data?: string }).data ?? ""
    if (node instanceof Element) return (node.children as DOMNode[]).map(textContent).join("")
    return ""
}

const options: HTMLReactParserOptions = {
    replace: (node) => {
        if (!(node instanceof Element)) return

        // Strip author classes. v2 Raven baked presentational utilities (e.g.
        // `text-sm`) into the stored HTML; because those classes also exist in
        // THIS app's compiled CSS, they apply and fight the .tiptap stylesheet
        // (old messages at 13px, new ones at 14px). The stylesheet is the single
        // source of truth for presentation, so legacy classes are dropped here.
        // `data-*` (mentions, emoji) and inline `style` (text-align) are kept.
        // The one class we DO need — a code block's `language-*` — is read in the
        // <pre> branch below, which runs on the parent before this strips a child.
        if (node.attribs?.class) delete node.attribs.class

        // Mentions: swap the stored span for an interactive component that
        // resolves the live name, flags self-mentions, and links channels.
        const mentionType = node.attribs?.["data-type"]
        const mentionID = node.attribs?.["data-id"]
        if (mentionID && (mentionType === "userMention" || mentionType === "channelMention")) {
            const fallback = mentionLabel(node)
            return mentionType === "userMention" ? (
                <UserMention id={mentionID} fallback={fallback} />
            ) : (
                <ChannelMention id={mentionID} fallback={fallback} />
            )
        }

        // Spoiler: swap the stored span for a click-to-reveal component (data-spoiler
        // survives the class-strip above, like mentions' data-*).
        if (node.name === "span" && node.attribs?.["data-spoiler"] !== undefined) {
            return <Spoiler>{domToReact(node.children as DOMNode[], options)}</Spoiler>
        }

        // The inline "(edited)" marker, injected into the final paragraph by
        // EditedMessageBody. A data-* marker for the same reason as spoilers:
        // classes don't survive the strip above.
        if (node.name === "span" && node.attribs?.["data-edited"] !== undefined) {
            return <span className="ml-1 text-sm text-ink-gray-5">{domToReact(node.children as DOMNode[], options)}</span>
        }

        // Custom emoji: an inline <img data-type="customEmoji">. Render it sized like an
        // emoji (the author class is stripped above), src-sanitized to a safe scheme.
        if (node.name === "img" && node.attribs?.["data-type"] === "customEmoji") {
            const src = (node.attribs.src ?? "").trim()
            if (!SAFE_IMG_SRC.test(src)) return <></>
            const alt = node.attribs.alt ?? ""
            // `emoji` class → sized by `.tiptap .emoji` (same rule as the composer),
            // which beats `.tiptap img` on specificity. Consistent inline emoji size.
            return <img src={src} alt={alt} title={alt} loading="lazy" className="emoji" />
        }

        // Code blocks: <pre><code class="language-xxx">…</code></pre>. Returning
        // an element stops recursion into the children, so the <code>'s class
        // survives the strip above — read the language + raw text here and hand
        // off to CodeBlock (highlighting + copy).
        if (node.name === "pre") {
            const codeEl = node.children.find(
                (child): child is Element => child instanceof Element && child.name === "code",
            )
            const language = (codeEl?.attribs?.class ?? "").match(/language-(\S+)/)?.[1]
            const code = textContent(codeEl ?? node).replace(/\n$/, "")
            return <CodeBlock code={code} language={language} />
        }

        // Tables: getHTML() emits a bare <table> (no wrapper). Wrap it in the same
        // `.tableWrapper` the editor's TableKit adds, so the shared stylesheet frames it
        // and scrolls wide tables horizontally instead of stretching the message row.
        if (node.name === "table") {
            return (
                <div className="tableWrapper">
                    <table>{domToReact(node.children as DOMNode[], options)}</table>
                </div>
            )
        }

        // Sanitize links: safe scheme only, always open in a new tab.
        // MessageLink renders the same anchor, plus the floating preview
        // when the user chose "Link Hover" mode.
        if (node.name === "a") {
            const href = (node.attribs?.href ?? "").trim()
            return (
                <MessageLink href={SAFE_HREF.test(href) ? href : undefined}>
                    {domToReact(node.children as DOMNode[], options)}
                </MessageLink>
            )
        }
    },
}

/* ------------------------------ Jumbomoji ------------------------------ */

const JUMBOMOJI_MAX = 4

/** A jumbo candidate is short by construction — skip the walk for real messages. */
const JUMBOMOJI_HTML_MAX_LENGTH = 800

/**
 * Keycap sequences (1️⃣ #️⃣) — their base [0-9#*] chars carry Emoji_Component,
 * so strip whole keycaps first; any digit/#/* left after that is real text.
 */
const KEYCAP_RE = /[0-9#*]\uFE0F?\u20E3/gu

/** Everything an emoji sequence may contain: pictographic bases + components
 * (skin tones, regional indicators, keycaps) + ZWJ + VS16 + whitespace. */
const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}\p{Emoji_Component}\u200D\uFE0F\s]*$/u

// Not in the tsconfig lib yet — minimal local shape (Safari 14.1+/Chrome 87+ at runtime).
type GraphemeSegmenter = { segment: (input: string) => Iterable<unknown> }
type GraphemeSegmenterCtor = new (locale?: string, options?: { granularity: "grapheme" }) => GraphemeSegmenter

const SegmenterCtor = (Intl as unknown as { Segmenter?: GraphemeSegmenterCtor }).Segmenter
const GRAPHEME_SEGMENTER = SegmenterCtor ? new SegmenterCtor(undefined, { granularity: "grapheme" }) : null

/** Emoji count of a text run, or null if it contains anything that isn't emoji/whitespace. */
const countEmojiGraphemes = (raw: string): number | null => {
    const text = raw.replace(/\s+/g, "")
    if (!text) return 0
    const withoutKeycaps = text.replace(KEYCAP_RE, "")
    if (/[0-9#*]/.test(withoutKeycaps)) return null
    if (!EMOJI_ONLY_RE.test(withoutKeycaps)) return null
    if (GRAPHEME_SEGMENTER) {
        let count = 0
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _segment of GRAPHEME_SEGMENTER.segment(text)) count++
        return count
    }
    // No Segmenter (old WebKit): code points over-count ZWJ sequences, which can
    // only FAIL the ≤ max gate — messages render normal-sized, never wrongly huge.
    return Array.from(text).length
}

/**
 * True when the message is ONLY emojis — 1 to 4 of them, native and/or custom —
 * so the stream can render them big (Slack/iMessage-style). Structure must be a
 * single <p> whose children are emoji text runs and customEmoji <img>s; anything
 * else (marks, mentions, links, more blocks) disqualifies.
 */
const isJumbomoji = (html: string, dom: DOMNode[]): boolean => {
    if (html.length > JUMBOMOJI_HTML_MAX_LENGTH) return false
    const blocks = dom.filter((node) => !(node instanceof Text && !node.data.trim()))
    if (blocks.length !== 1) return false
    const paragraph = blocks[0]
    if (!(paragraph instanceof Element) || paragraph.name !== "p") return false

    let count = 0
    for (const child of paragraph.children as DOMNode[]) {
        if (child instanceof Text) {
            const n = countEmojiGraphemes(child.data)
            if (n === null) return false
            count += n
        } else if (child instanceof Element && child.name === "img" && child.attribs?.["data-type"] === "customEmoji") {
            count += 1
        } else {
            return false
        }
    }
    return count >= 1 && count <= JUMBOMOJI_MAX
}

/**
 * Parse-and-check for callers outside the renderer. The inline "(edited)"
 * marker must NOT be injected into a jumbomoji paragraph — the added text
 * would fail the emoji-only walk above and shrink the emojis. The length
 * gate skips the parse for anything that can't be jumbomoji anyway.
 */
export const isJumbomojiHtml = (html: string): boolean =>
    html.length <= JUMBOMOJI_HTML_MAX_LENGTH &&
    isJumbomoji(html, htmlToDOM(html, { lowerCaseAttributeNames: false }))

export const RichTextRenderer = ({ html, jumbomoji = false }: { html: string; jumbomoji?: boolean }) => {
    const { tree, jumbo } = useMemo(() => {
        // Same two steps parse() runs internally, split so ONE parsed DOM feeds
        // both the React conversion and the jumbomoji check (no second parse).
        const dom = htmlToDOM(html, { lowerCaseAttributeNames: false })
        return {
            tree: domToReact(dom, options),
            jumbo: jumbomoji && isJumbomoji(html, dom),
        }
    }, [html, jumbomoji])
    return <div className={cn("tiptap", jumbo && "tiptap--jumbomoji")}>{tree}</div>
}

export default RichTextRenderer
