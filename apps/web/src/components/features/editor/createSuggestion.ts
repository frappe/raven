import { ReactRenderer } from "@tiptap/react"
import type { ComponentType, ReactNode } from "react"
import type { PluginKey } from "@tiptap/pm/state"
import { findSuggestionMatch, type SuggestionMatch, type SuggestionOptions, type Trigger } from "@tiptap/suggestion"
import type { MentionNodeAttrs } from "@tiptap/extension-mention"
import { SuggestionList, type SuggestionListProps } from "./SuggestionList"
import { setSuggestionPopupVisible } from "./suggestion"

/** Node attrs we insert — kept compatible with Tiptap's MentionNodeAttrs (id/label `string | null`). */
export type MentionAttrs = MentionNodeAttrs

/**
 * Stock suggestion matcher with a smarter prefix rule. The default only fires
 * after a SPACE (or at block start), so "(@user", "[@user", quotes and dashes
 * never opened the popup. Instead: run the stock matcher with its prefix check
 * off, then reject only when the character right before the trigger is a word
 * character — which is exactly what keeps emails ("nikhil@frappe…") and URLs
 * ("https://…" for the ":" trigger) from popping the list mid-word.
 */
export const findSuggestionMatchAfterNonWord = (config: Trigger): SuggestionMatch => {
    const match = findSuggestionMatch({ ...config, allowedPrefixes: null })
    if (!match) return null
    const from = match.range.from
    // Char immediately before the trigger. Leaf nodes (emojis, mentions) read as
    // "\0" and block boundaries as "" — both non-word, so both allow the trigger.
    const before = config.$position.doc.textBetween(Math.max(0, from - 1), from, "\0", "\0")
    return /[\p{L}\p{N}_]/u.test(before) ? null : match
}

interface SuggestionRenderConfig<T, A> {
    /** Row contents for an item. */
    renderItem: (item: T) => ReactNode
    getKey: (item: T) => string
    /** Map the chosen item to what the suggestion's `command` expects. */
    toCommandArg: (item: T) => A
}

/**
 * The shared popup for every editor suggestion (@mentions, #channels, :emoji:).
 * Holds all selection/keyboard state in this closure (not in the React component or
 * a ref), mounts the generic SuggestionList into the editor's `[data-raven-editor]`
 * wrapper, and positions it above the composer with CSS — no positioning library.
 * Escape is handled natively by @tiptap/suggestion. Keeps the visible-popup count
 * (suggestion.ts) in sync so the editor's Enter handler only defers when a popup is
 * actually showing items.
 */
export function createSuggestionRender<T, A>(
    config: SuggestionRenderConfig<T, A>,
): SuggestionOptions<T, A>["render"] {
    const ListComponent = SuggestionList as ComponentType<SuggestionListProps<T>>

    return () => {
        let renderer: ReactRenderer<unknown, SuggestionListProps<T>> | null = null
        let items: T[] = []
        let selectedIndex = 0
        let visible = false
        let command: (arg: A) => void = () => {}

        const choose = (index: number) => {
            const item = items[index]
            if (item) command(config.toCommandArg(item))
        }
        const onHover = (index: number) => {
            selectedIndex = index
            update()
        }
        const props = () => ({
            items,
            selectedIndex,
            onSelect: choose,
            onHover,
            renderItem: config.renderItem,
            getKey: config.getKey,
        })
        const update = () => {
            const nextVisible = items.length > 0
            setSuggestionPopupVisible(visible, nextVisible)
            visible = nextVisible
            renderer?.updateProps(props())
        }

        return {
            onStart: (start) => {
                items = start.items
                selectedIndex = 0
                command = start.command
                renderer = new ReactRenderer(ListComponent, { editor: start.editor, props: props() })
                const anchor = start.editor.view.dom.closest("[data-raven-editor]") ?? document.body
                const element = renderer.element as HTMLElement
                element.className = "absolute left-0 bottom-full z-50 mb-2"
                anchor.appendChild(element)
                update()
            },
            onUpdate: (next) => {
                items = next.items
                command = next.command
                if (selectedIndex > items.length - 1) selectedIndex = 0
                update()
            },
            onKeyDown: (key) => {
                if (items.length === 0) return false
                switch (key.event.key) {
                    case "ArrowUp":
                        selectedIndex = (selectedIndex + items.length - 1) % items.length
                        update()
                        return true
                    case "ArrowDown":
                        selectedIndex = (selectedIndex + 1) % items.length
                        update()
                        return true
                    case "Enter":
                        choose(selectedIndex)
                        return true
                    default:
                        return false
                }
            },
            onExit: () => {
                setSuggestionPopupVisible(visible, false)
                visible = false
                renderer?.element.remove()
                renderer?.destroy()
                renderer = null
            },
        }
    }
}

interface MentionSuggestionConfig<T> {
    char: string
    pluginKey: PluginKey
    /** The Mention node name to insert (`userMention`, `channelMention`). */
    nodeName: string
    getItems: (query: string) => T[]
    toAttrs: (item: T) => MentionAttrs
    renderItem: (item: T) => ReactNode
    getKey: (item: T) => string
}

/** A complete Mention suggestion config (inserts a mention node). Wraps the shared render. */
export function createMentionSuggestion<T>(
    config: MentionSuggestionConfig<T>,
): Omit<SuggestionOptions<T, MentionAttrs>, "editor"> {
    return {
        char: config.char,
        pluginKey: config.pluginKey,
        findSuggestionMatch: findSuggestionMatchAfterNonWord,
        items: ({ query }) => config.getItems(query),
        command: ({ editor, range, props }) => {
            editor
                .chain()
                .focus()
                .insertContentAt(range, [
                    // `mentionSuggestionChar` must be the trigger char: Mention's Backspace
                    // handler re-inserts it (defaults to "@") when you delete the node.
                    { type: config.nodeName, attrs: { ...props, mentionSuggestionChar: config.char } },
                    { type: "text", text: " " },
                ])
                .run()
        },
        render: createSuggestionRender<T, MentionAttrs>({
            renderItem: config.renderItem,
            getKey: config.getKey,
            toCommandArg: config.toAttrs,
        }),
    }
}
