/**
 * Phone-number detection for message text. Pure logic — the renderer
 * (RichTextRenderer) maps the runs this produces onto tel: anchors.
 *
 * Deliberately conservative: a missed phone number is a minor shrug, a
 * linkified order id or date looks broken.
 */

/** Cheap gate before the real scan — most text has no digit run at all. */
export const MAYBE_PHONE_RE = /\d[\d\s()-]{5,}\d/

/**
 * Candidate phone runs: an optional + and/or opening paren, then digits with
 * space/dash/paren separators. Dots are deliberately NOT separators (IPs,
 * versions). The lookarounds keep the run out of words, emails, and longer
 * digit/id runs.
 */
const PHONE_CANDIDATE_RE = /(?<![\p{L}\d@._+-])\+?\(?\d[\d\s()-]{5,17}\d(?![\p{L}\d-])/gu

/**
 * Candidate → tel: href, or null for the shapes that are usually NOT phones:
 * - "+" international: 7-15 digits, always accepted (the + is unambiguous).
 * - Separated local forms ("98765 43210", "(555) 123-4567"): 8-12 digits,
 *   minus date shapes (2026-09-08 splits into 4/2/2-sized groups).
 * - Bare digit runs: only the classic 10-digit mobile number.
 */
export const phoneHref = (raw: string): string | null => {
    const digits = raw.replace(/\D/g, "")
    if (raw.startsWith("+")) {
        return digits.length >= 7 && digits.length <= 15 ? `tel:+${digits}` : null
    }
    const groups = raw.split(/[\s()-]+/).filter(Boolean).map((group) => group.length)
    if (groups.length === 3 && groups.every((len) => len === 2 || len === 4)) return null
    if (groups.length > 1) {
        return digits.length >= 8 && digits.length <= 12 ? `tel:${digits}` : null
    }
    return digits.length === 10 ? `tel:${digits}` : null
}

/** One piece of a text run: plain text, or a detected phone (href set). */
export type PhoneRun = { text: string; href?: string }

/**
 * Split a text run around its phone numbers. Returns null when nothing
 * qualified, so callers can keep the original node untouched (the common
 * case pays nothing beyond MAYBE_PHONE_RE).
 */
export const splitPhoneRuns = (text: string): PhoneRun[] | null => {
    const runs: PhoneRun[] = []
    let last = 0
    for (const match of text.matchAll(PHONE_CANDIDATE_RE)) {
        const href = phoneHref(match[0])
        if (!href) continue
        if (match.index > last) runs.push({ text: text.slice(last, match.index) })
        runs.push({ text: match[0], href })
        last = match.index + match[0].length
    }
    if (runs.length === 0) return null
    if (last < text.length) runs.push({ text: text.slice(last) })
    return runs
}
