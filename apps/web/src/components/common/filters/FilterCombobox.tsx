import { useState, type ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@components/ui/command"
import { Button } from "@components/ui/button"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"
import { cn } from "@lib/utils"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"
import { scoreFilterRow } from "./filterScore"
import { useFilterListScroll } from "./useFilterListScroll"

/**
 * DropdownMenuItem's type scale and geometry, so a filter row reads like a menu row.
 * text-lg md:text-base (15/14) restates CommandItem's own scale — kept explicit so a
 * filter row can't drift if the base ever changes. Two deliberate departures: a fixed
 * h-7.5 instead of py-2/md:py-1.5, so every row lines up with the trigger and the
 * search field; and hover:, because these are cmdk rows and a plain button, neither
 * of which takes DropdownMenu's focus: highlight.
 */
export const FILTER_ITEM_STYLES = "flex h-7.5 cursor-pointer items-center gap-2 rounded px-2 text-lg md:text-base text-ink-gray-7 hover:bg-surface-gray-2"

/**
 * The trigger's own geometry, exported for the filters that sit in the same row but
 * aren't built on this shell (FileTypeFilter is a checkbox list, not a searchable one).
 * Pair it with Button variant="subtle" size="sm".
 */
export const FILTER_TRIGGER_STYLES = "h-7.5 w-fit justify-between gap-2 overflow-hidden font-normal cursor-pointer"

/**
 * One width for every filter popover in the app, whatever its trigger measures. The trigger
 * is sized by the row it sits in — a third of the search bar, a fixed 160px on threads — but
 * the list underneath holds the same content everywhere, so it gets the same width. It only
 * ever grows from here: min-w keeps it at least as wide as the trigger it hangs off.
 */
export const FILTER_DROPDOWN_WIDTH = "w-64"

/**
 * cmdk highlights the first item whenever its selection is empty — on mount, and again
 * on every search change. Seeding the selection with a string no item can match leaves
 * the list unhighlighted on open, so nothing looks pre-chosen and Enter can't pick a row
 * the user never pointed at. Typing still highlights the top match (search change
 * re-runs selectFirstItem), and ArrowDown from nothing lands on the first row.
 */
const NO_SELECTION = "__filter-combobox-no-selection__"

/** The p-2 gutter every filter-hosting page uses, in px. Also the collision padding for
 *  filter popovers that aren't built on this shell, so they keep the same edge gap. */
export const PAGE_GUTTER = 8

/** FILTER_ITEM_STYLES' h-7.5, in px. */
const ROW_HEIGHT = 30
/** CommandGroup's p-1 gutter, in px — the list's own breathing room at both ends. */
const LIST_PADDING = 4
/** Slightly tighter than the top gutter — a full 4px under the last row read as a gap. */
const LIST_BOTTOM_GAP = 3
/**
 * The list shows whole rows only: its viewport is the top gutter, an exact number of rows,
 * and a hair of space under the last one. So no row is ever sliced and none sits flush
 * against an edge. Group headings are pinned to ROW_HEIGHT (see the heading override on the
 * scroll container) so a list with headings lands on the same boundary as one without —
 * at cmdk's natural 26.95px heading the channel list ended up 4px looser than the user list.
 */
const VISIBLE_ROWS = 10
const LIST_HEIGHT = LIST_PADDING + ROW_HEIGHT * VISIBLE_ROWS + LIST_BOTTOM_GAP

/**
 * One selectable row, with the trailing check DropdownMenu's checkable items carry.
 * Both filters rendered this identically by hand; keeping it here is what stops the
 * checked-row treatment from drifting between them.
 */
export function FilterComboboxItem({
    value, keywords, selected, onSelect, children, className,
}: {
    /**
     * The row's identity for cmdk — pass the doc name. It's unique per doctype, so rows can
     * never collide the way two people called "Aditya Patil" would if this were their name.
     * Searchable as a fallback (see scoreFilterRow), but ranking comes from `keywords`.
     */
    value: string
    /** What a person reads and types — the channel or user's name. This is what's ranked. */
    keywords?: string[]
    selected: boolean
    onSelect: () => void
    children: ReactNode
    className?: string
}) {
    return (
        <CommandItem
            value={value}
            keywords={keywords}
            onSelect={onSelect}
            // Not cmdk's data-selected (that one tracks the highlight, which moves with the
            // pointer) — this marks the row holding the filter's current value, so the shell
            // can find it and scroll to it on open. See CHOSEN_ROW_ATTR.
            data-filter-chosen={selected || undefined}
            className={cn(
                FILTER_ITEM_STYLES,
                "justify-between",
                // The chosen row is painted rather than left to the check alone, and it
                // darkens to gray-3 when pointed at. That second step keys off cmdk's
                // data-selected, not hover: cmdk marks the row under the pointer selected,
                // and CommandItem's own data-[selected=true]:bg-surface-gray-2 outranks a
                // hover: class, so a hover-based rule here silently did nothing.
                selected && "bg-surface-gray-2 data-[selected=true]:bg-surface-gray-3",
                className,
            )}
        >
            {children}
            {selected && <CheckIcon className="size-4 shrink-0 text-ink-gray-6" />}
        </CommandItem>
    )
}

interface FilterComboboxProps {
    /** Rendered inside the trigger button, left of the chevron. */
    trigger: ReactNode
    emptyLabel: string
    /**
     * Receives a `close` callback — every item must call it after selecting — and the
     * current search text, for lists whose shape depends on whether one is being run.
     */
    children: (close: () => void, search: string) => ReactNode
    /**
     * Resets the filter. Pass it only while something IS selected: its presence is what
     * turns the trigger's chevron into a clear button, so an unset filter shows no way to
     * clear what isn't there.
     */
    onClear?: () => void
    /** The trigger's width, which its row decides. The popover doesn't follow it. */
    triggerClassName?: string
    /** Root wrapper — width/shrink control so the filter can flex down in a shared row. */
    className?: string
    /**
     * Set this when the combobox lives inside a MODAL dialog.
     *
     * Radix Dialog locks scrolling through react-remove-scroll, which preventDefaults wheel
     * events on everything outside the dialog's own content — and this popover portals to
     * document.body, so it counts as outside. Its list then can't be scrolled by wheel at
     * all, while keyboard navigation still works (cmdk scrolls the highlighted row
     * programmatically, which no wheel handler sees).
     *
     * A modal popover pushes its OWN scroll lock, and react-remove-scroll only lets the
     * top of the lock stack act — so the dialog's lock steps aside and this list becomes
     * the scrollable region. That's the library's intended answer for nested locks.
     */
    modal?: boolean
}

/**
 * The shell shared by the search filter comboboxes (channel, user): trigger button,
 * popover, search box, scroll container and empty state. Callers supply only the
 * items, so the two filters can't drift apart in sizing or scroll behaviour.
 */
export function FilterCombobox({
    trigger,
    emptyLabel,
    children,
    onClear,
    triggerClassName,
    className,
    modal = false,
}: FilterComboboxProps) {
    const [open, setOpen] = useState(false)
    const isMobile = useIsMobile()
    // cmdk's search and highlight are controlled so they can be reset between opens WITHOUT
    // remounting the list. Remounting would restart every row's Radix Avatar, and that
    // component only shows its image once its own load resolves — so each open flashed
    // the initials fallback for every user, even on cached images.
    const [search, setSearch] = useState("")
    const [highlighted, setHighlighted] = useState(NO_SELECTION)

    // The two resets sit on OPPOSITE edges on purpose. Clearing the search is itself a
    // search change, and cmdk schedules selectFirstItem on every search change — so
    // clearing on open would re-highlight row 1 right after we cleared the highlight.
    // Clearing it on close lets that fire and settle while the popover is shut; the next
    // open then only has to clear the highlight, with no search change to undo it.
    const onOpenChange = (next: boolean) => {
        setOpen(next)
        if (next) setHighlighted(NO_SELECTION)
        else setSearch("")
    }

    const scrollRef = useFilterListScroll(open, search, LIST_PADDING)

    return (
        // flex, not the default block: the trigger is an inline-flex Button, so a block
        // wrapper puts it on a line box and inherits that line's descender space. Harmless
        // while the trigger is text — its baseline matches — but an avatar inside baselines
        // at its bottom edge, which grew the wrapper to 31.5px against the trigger's 30 and
        // nudged the whole filter row (and everything under it) down by a pixel.
        // relative: the clear button is positioned over the chevron's place.
        <div className={cn("relative flex shrink-0", className)}>
            <Popover open={open} onOpenChange={onOpenChange} modal={modal}>
                <PopoverTrigger asChild>
                    <Button
                        variant="subtle"
                        size="sm"
                        role="combobox"
                        aria-expanded={open}
                        // h-7.5 (30px) matches the search page's TabsList, which the trigger
                        // sits beside: subtle/md TabsTrigger is py-1.5 + text-base/1.15 = 28px,
                        // plus the list's p-px = 30px. Matching the row it lives in beats
                        // matching the popover's own h-8 search field, which is a separate
                        // surface. No `!` needed: cn() puts className after the variant classes.
                        // pr-7 while clearable: room for the clear button sitting on top.
                        className={cn(FILTER_TRIGGER_STYLES, onClear && "pr-7", triggerClassName)}
                    >
                        {trigger}
                        {!onClear && <ChevronDownIcon className="size-4 shrink-0 text-ink-gray-4" />}
                    </Button>
                </PopoverTrigger>
                {/* A sibling of the trigger rather than a child of it: a button inside a
                    button is invalid markup, and a span with a click handler would leave
                    keyboard users no way to clear now that the list has no Clear row.
                    Absolutely positioned so it takes the chevron's place without the trigger
                    having to give up any width. */}
                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        aria-label={_("Clear filter")}
                        className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-ink-gray-5 hover:bg-surface-gray-4 hover:text-ink-gray-8"
                    >
                        <XIcon className="size-3.5" />
                    </button>
                )}
                <PopoverContent
                    side="bottom"
                    align="start"
                    // Every page that hosts a filter wraps the row in p-2, and a popover wider
                    // than its trigger would otherwise run to the screen edge on mobile. Radix
                    // shifts the content to keep this gap, so the menu lines up with the page
                    // gutter from whichever trigger it hangs off — no per-page alignment.
                    collisionPadding={PAGE_GUTTER}
                    // Radix focuses the popover's first tabbable on open — here the search
                    // field, which throws up the on-screen keyboard and buries the list it
                    // is meant to filter. Desktop keeps it: typing straight away is the point.
                    onOpenAutoFocus={(event) => { if (isMobile) event.preventDefault() }}
                    // shadow-2xl matches DropdownMenuContent's elevation. Its hairline is
                    // the popover's own border rather than DropdownMenu's ring-black/5 —
                    // same result, without spreading an opacity override into new code.
                    // No max-height here: the list caps itself at a whole number of rows and
                    // the popover sizes to that, so the field and the list are the only two
                    // things deciding the height.
                    className={cn(
                        "flex min-w-(--radix-popover-trigger-width) flex-col p-0 shadow-2xl",
                        FILTER_DROPDOWN_WIDTH,
                                        )}
                >
                    {/* bg-transparent: Command defaults to elevation-1, which would paint
                        over the popover's elevation-2 — the surface DropdownMenu uses. */}
                    {/* This popover's content stays mounted after it closes, so cmdk would
                        otherwise carry its search text and highlight into the next open — you
                        reopen onto the last query with the list still filtered. onOpenChange
                        resets both instead, which leaves the rows (and their avatars) mounted. */}
                    <Command
                        shouldFilter
                        filter={scoreFilterRow}
                        value={highlighted}
                        onValueChange={setHighlighted}
                        className="min-h-0 flex-1 bg-transparent"
                    >
                        {/* Espresso's Input pairs a size with a type step: sm/h-7 and md/h-8
                            take text-base, and text-xl belongs to lg/h-10. CommandInput
                            hardcodes text-xl md:text-base, so on mobile a large-input type
                            would land in a field smaller than sm. text-base restores the
                            pairing; the plain variant keeps the taller box on mobile for touch. */}
                        <CommandInput
                            variant="plain"
                            // The field sits inside the filter it searches; naming the
                            // list again adds nothing.
                            placeholder={_("Search")}
                            value={search}
                            onValueChange={setSearch}
                            className="text-base"
                        />
                        {/* cmdk's own list caps its height and scrolls; this wrapper owns the
                            scroll instead so the popover can size to content. overscroll-contain
                            is what stops the page behind scrolling on once this list bottoms out —
                            not a wheel handler: React registers wheel passively, so preventDefault
                            there is a no-op and the browser's own scroll lands on top of any
                            manual scrollTop. */}
                        {/* CommandGroup's own p-1 is the viewport gutter and CommandItem's own
                            px-2 is the row padding — the same geometry DropdownMenuContent gets
                            from its p-1, so no padding overrides are needed. The one override
                            left is the group label's type: DropdownMenuLabel is text-sm-medium,
                            and px-2/py-1.5/text-ink-gray-4 already match. */}
                        {/* relative so a row's offsetTop is measured against this box — the
                            scroll-to-chosen maths can't use getBoundingClientRect here, since
                            the popover's open animation leaves a scale() on the subtree and
                            every rect comes back 5% short. */}
                        <div
                            ref={scrollRef}
                            style={{ maxHeight: LIST_HEIGHT }}
                            // Headings are h-7.5 like the rows: cmdk's own px-2/py-1.5 gives
                            // 26.95px, which knocks every row below it off the row grid and
                            // leaves a different amount of slack at the bottom than a list
                            // with no headings. flex/items-center keeps the label centred in
                            // the taller box.
                            // DropdownMenuLabel's type, pinned in full: CommandGroup's own
                            // heading default is the command PALETTE's (text-base regular
                            // ink-gray-5), so the menu-label look lives entirely here. The
                            // selectors go through [cmdk-group] to outrank the base heading
                            // utilities on specificity — at equal specificity the winner is
                            // Tailwind's generated order, which is a coin toss per property.
                            // Spelled as text-sm + font-medium, not .text-sm-medium — that
                            // espresso class is @layer components, and a non-utility class
                            // behind a [&_…] variant compiles to nothing.
                            className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain overflow-x-hidden [&_[cmdk-group]_[cmdk-group-heading]]:text-sm [&_[cmdk-group]_[cmdk-group-heading]]:font-medium [&_[cmdk-group]_[cmdk-group-heading]]:text-ink-gray-4 [&_[cmdk-group]_[cmdk-group-heading]]:flex [&_[cmdk-group]_[cmdk-group-heading]]:h-7.5 [&_[cmdk-group]_[cmdk-group-heading]]:items-center [&_[cmdk-group]_[cmdk-group-heading]]:py-0"
                        >
                            <CommandList className="max-h-none overflow-visible">
                                <CommandEmpty>{emptyLabel}</CommandEmpty>
                                {children(() => onOpenChange(false), search)}
                            </CommandList>
                        </div>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
