import { escapeHtml } from "@utils/htmlUtils"
import _ from "@lib/translate"

/**
 * List preview for a poll message, built from the message's plain `content`.
 * The server stores a poll's content as the question on the first line and one
 * numbered option per line after it. A live poll card would fire a fetch per row,
 * so lists render this static block instead. Falls back to a plain "Poll" label
 * for old rows with no content.
 */
export const pollPreviewHtml = (content?: string | null): string => {
    const lines = (content ?? "").split("\n").map((line) => line.trim()).filter(Boolean)
    if (lines.length === 0) return `<p>📊 ${escapeHtml(_("Poll"))}</p>`
    const [question, ...options] = lines
    return [`<p>📊 ${escapeHtml(question)}</p>`, ...options.map((option) => `<p>${escapeHtml(option)}</p>`)].join("")
}
