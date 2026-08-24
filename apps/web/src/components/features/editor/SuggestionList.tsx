import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@lib/utils"

export interface SuggestionListProps<T> {
    items: T[]
    /** Index of the highlighted row (driven by the suggestion closure). */
    selectedIndex: number
    /** Choose the row at `index` (keyboard Enter or click). */
    onSelect: (index: number) => void
    /** Highlight the row at `index` on hover. */
    onHover: (index: number) => void
    /** Row contents for an item (avatar + name, # + channel, …). */
    renderItem: (item: T) => ReactNode
    getKey: (item: T) => string
}

/**
 * The dropdown shared by every editor suggestion (@mentions, #channels, later
 * :emoji:) — purely presentational. Selection state and keyboard handling live in
 * the suggestion closure (createSuggestion); this renders rows and reports
 * clicks/hovers. Positioned above the composer by the suggestion; styling mirrors
 * the dropdown-menu component.
 */
export function SuggestionList<T>({ items, selectedIndex, onSelect, onHover, renderItem, getKey }: SuggestionListProps<T>) {
    const selectedRef = useRef<HTMLButtonElement>(null)

    // Keep the highlighted row visible as arrow keys move past the scroll edges.
    // "nearest" scrolls the list minimally without yanking the page.
    useEffect(() => {
        selectedRef.current?.scrollIntoView({ block: "nearest", })
    }, [selectedIndex])

    if (items.length === 0) return null

    return (
        <div
            // Fixed width (not min-width) so the popup doesn't resize/shift as the
            // longest result changes while typing; names/shortcodes truncate instead.
            className="flex max-h-72 w-72 flex-col overflow-y-auto rounded-lg bg-surface-elevation-2 p-1 shadow-2xl ring-1 ring-black/5"
            // Keep focus in the editor when clicking a row — otherwise mousedown blurs
            // the editor, the suggestion exits, and the click never lands.
            onMouseDown={(e) => e.preventDefault()}
        >
            {items.map((item, index) => (
                <button
                    key={getKey(item)}
                    ref={index === selectedIndex ? selectedRef : undefined}
                    type="button"
                    className={cn(
                        "flex select-none items-center gap-2 rounded px-2 py-1.5 text-left text-base text-ink-gray-7",
                        index === selectedIndex ? "bg-surface-gray-3" : "hover:bg-surface-gray-2",
                    )}
                    onMouseEnter={() => onHover(index)}
                    onClick={() => onSelect(index)}
                >
                    {renderItem(item)}
                </button>
            ))}
        </div>
    )
}
