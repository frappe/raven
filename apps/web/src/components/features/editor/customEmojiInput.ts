import type { EditorState, Transaction } from "@tiptap/pm/state"
import { Mapping } from "@tiptap/pm/transform"
import { getDefaultStore } from "jotai"
import { customEmojiShortcodesAtom, splitCustomEmojiShortcodes } from "@lib/customEmojiShortcodes"

// From the state, not @tiptap/pm/model: two prosemirror-model copies are installed.
type PMNode = EditorState["doc"]

const isCodeText = (node: PMNode) => node.marks.some((mark) => mark.type.spec.code)

/** True when `pos` sits in a code block or in inline code. */
export const isInCode = (state: EditorState, pos: number): boolean => {
    if (state.doc.resolve(pos).parent.type.spec.code) return true
    const node = state.doc.nodeAt(pos)
    return !!node?.isText && isCodeText(node)
}

/** The opening backtick of an unclosed inline code before `pos` in its paragraph, if any. */
const unclosedBacktick = (doc: PMNode, pos: number): number | null => {
    const start = doc.resolve(pos).start()
    let count = 0
    let last = -1
    doc.nodesBetween(start, pos, (node, nodePos) => {
        if (!node.isText || isCodeText(node)) return
        const text = node.text ?? ""
        for (let i = Math.max(0, start - nodePos); i < Math.min(text.length, pos - nodePos); i++) {
            if (text[i] === "`") {
                count++
                last = nodePos + i
            }
        }
    })
    return count % 2 ? last : null
}

/** Where `transactions` changed the final document; the whole document without them. */
const changedRanges = (doc: PMNode, transactions?: readonly Transaction[]): [number, number][] => {
    if (!transactions) return [[0, doc.content.size]]
    const maps = transactions.flatMap((tr) => tr.mapping.maps)
    const mapping = new Mapping(maps)
    const ranges: [number, number][] = []
    maps.forEach((map, i) => {
        const after = mapping.slice(i + 1)
        map.forEach((_oldFrom, _oldTo, from, to) => ranges.push([after.map(from, -1), after.map(to, 1)]))
    })
    return ranges
}

/**
 * Swaps each known `:name:` in the changed paragraphs for its emoji (code keeps it), and
 * drops the unclosed backtick before each emoji added, as that inline code could never close.
 * Without `transactions`, checks the whole document. Null when nothing changes.
 */
export const customEmojiInputTransaction = (
    state: EditorState,
    transactions?: readonly Transaction[],
): Transaction | null => {
    const shortcodes = getDefaultStore().get(customEmojiShortcodesAtom)
    const swaps: { from: number; to: number; src: string; shortcode: string }[] = []
    // Emojis that weren't there before: the swaps, plus ones the picker or popup inserted.
    const added = new Set<number>()
    const scanned = new Set<number>()
    for (const [from, to] of changedRanges(state.doc, transactions)) {
        state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.spec.code) return false
            if (transactions && node.type.name === "customEmoji" && pos >= from && pos < to) added.add(pos)
            if (!node.isTextblock || scanned.has(pos)) return
            scanned.add(pos)
            if (!shortcodes) return
            node.forEach((child, offset) => {
                if (!child.isText || isCodeText(child)) return
                let at = pos + 1 + offset
                for (const part of splitCustomEmojiShortcodes(child.text ?? "", shortcodes) ?? []) {
                    if (typeof part === "string") at += part.length
                    else {
                        swaps.push({ from: at, to: at + part.shortcode.length, ...part })
                        added.add(at)
                        at += part.shortcode.length
                    }
                }
            })
        })
    }

    const backticks = new Set<number>()
    for (const pos of added) {
        const backtick = unclosedBacktick(state.doc, pos)
        if (backtick !== null) backticks.add(backtick)
    }
    if (!swaps.length && !backticks.size) return null

    // Apply from the end of the document, so earlier positions stay valid.
    const edits = [
        ...swaps.map((swap) => ({ pos: swap.from, swap })),
        ...[...backticks].map((pos) => ({ pos, swap: null })),
    ].sort((a, b) => b.pos - a.pos)
    const tr = state.tr
    const type = state.schema.nodes.customEmoji
    for (const { pos, swap } of edits) {
        if (swap) tr.replaceWith(swap.from, swap.to, type.create({ src: swap.src, alt: swap.shortcode }))
        else tr.delete(pos, pos + 1)
    }
    return tr
}
