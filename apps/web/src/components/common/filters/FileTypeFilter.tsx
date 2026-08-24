import { FileText, Image, FileSpreadsheet, Presentation, ChevronDownIcon, XIcon } from 'lucide-react';
import { Checkbox } from '@components/ui/checkbox';
import { Button } from '@components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { FILTER_DROPDOWN_WIDTH, FILTER_ITEM_STYLES, FILTER_TRIGGER_STYLES, PAGE_GUTTER } from './FilterCombobox';
import { useCallback, useState } from 'react';
import { cn } from '@lib/utils';
import _ from '@lib/translate';

export const FILE_TYPE_GROUPS: Record<string, string[]> = {
    pdf: ['PDF'],
    doc: ['DOC', 'DOCX', 'ODT', 'OTT', 'RTF', 'TXT', 'DOT', 'DOTX', 'DOCM', 'DOTM', 'PAGES'],
    ppt: ['PPT', 'PPTX', 'ODP', 'OTP', 'PPS', 'PPSX', 'POT', 'POTX', 'PPTM', 'PPSM', 'POTM', 'PPAM', 'PPA', 'KEY'],
    xls: ['XLS', 'XLSX', 'CSV', 'ODS', 'OTS', 'XLSB', 'XLSM', 'XLT', 'XLTX', 'XLTM', 'XLAM', 'XLA', 'NUMBERS'],
    image: ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG', 'BMP', 'TIFF', 'HEIC', 'HEIF', 'AVIF', 'ICO'],
}

export const expandFileTypeGroups = (groups: string[]): string[] => {
    const out = new Set<string>()
    for (const g of groups) FILE_TYPE_GROUPS[g]?.forEach((ext) => out.add(ext))
    return [...out]
}

/** Shared with the mobile filter sheet, which renders these as chips. */
export const FILE_TYPE_OPTIONS = [
    { id: 'pdf', label: 'PDFs', icon: FileText },
    { id: 'doc', label: 'Documents', icon: FileText },
    { id: 'ppt', label: 'Presentations', icon: Presentation },
    { id: 'xls', label: 'Spreadsheets', icon: FileSpreadsheet },
    { id: 'image', label: 'Images', icon: Image },
]

/**
 * Selected ids as "PDFs, Images". Listed in FILE_TYPE_OPTIONS order rather than the order
 * boxes were ticked, so the wording is stable — the trigger and the active-filter badge
 * both read from here and can't word the same selection differently. `maxNamed` caps the
 * list: past it the tail becomes "and N more".
 */
export const formatFileTypeNames = (ids: string[], maxNamed?: number): string => {
    const names = FILE_TYPE_OPTIONS
        .filter((option) => ids.includes(option.id))
        .map((option) => _(option.label))
    if (maxNamed && names.length > maxNamed) {
        return _('{0} and {1} more', [names.slice(0, maxNamed).join(', '), String(names.length - maxNamed)])
    }
    return names.join(', ')
}

/**
 * Up to this many selections are named in the trigger; past it the label is a count.
 * Three names is where a reader still parses the list at a glance, and the last one
 * truncating is a fair trade for saying which types they are.
 */
const MAX_NAMED_TYPES = 3

interface FileTypeFilterProps {
    /** Selected group ids ("pdf", "image", …). Multi-select, so an array. */
    value: string[]
    onValueChange: (value: string[]) => void
    /** Trigger text while nothing is picked — see UserFilter's placeholder. */
    placeholder?: string
    /** The trigger's width, which its row decides. The popover doesn't follow it. */
    triggerClassName?: string
    /** Root wrapper — width/shrink control so the filter can flex down in a shared row. */
    className?: string
}

/**
 * File-type picker for the filter bars. Multi-select, so it isn't built on
 * FilterCombobox (that shell is a searchable single-choice list) — it borrows the
 * shell's trigger and row styles instead, which is what keeps the three filters in
 * the row looking like one set. Five fixed options need no search field.
 */
export function FileTypeFilter({ value, onValueChange, placeholder, triggerClassName, className }: FileTypeFilterProps) {
    const selected = value
    const checkedCount = selected.length
    const [open, setOpen] = useState(false)

    const toggleFileType = useCallback((id: string) => {
        onValueChange(selected.includes(id)
            ? selected.filter((ft) => ft !== id)
            : [...selected, id])
    }, [selected, onValueChange])

    // Name the selection while there are few enough to read, then switch to a count. The
    // names are listed in FILE_TYPE_OPTIONS order, not click order, so the label doesn't
    // reshuffle as boxes are ticked; the span's `truncate` clips the last one when the
    // trigger is too narrow for all three.
    const triggerLabel = checkedCount === 0
        ? placeholder ?? _('File Type')
        : checkedCount <= MAX_NAMED_TYPES
            ? formatFileTypeNames(selected)
            : _('{0} Types', [String(checkedCount)])

    return (
        // flex for the same reason as FilterCombobox: a block wrapper around an inline-flex
        // trigger adds a line box's descender under it.
        <div className={cn("flex shrink-0", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="subtle"
                        size="sm"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(FILTER_TRIGGER_STYLES, triggerClassName)}
                    >
                        <span className={cn(
                            "min-w-0 flex-1 truncate text-left leading-snug",
                            checkedCount === 0 && "text-ink-gray-4",
                        )}>
                            {triggerLabel}
                        </span>
                        <ChevronDownIcon className="size-4 shrink-0 text-ink-gray-4" />
                    </Button>
                </PopoverTrigger>
                {/* Same elevation, gutter and row geometry as FilterCombobox's popover. */}
                <PopoverContent
                    align="start"
                    collisionPadding={PAGE_GUTTER}
                    // Radix focuses the first row on open, which paints a focus ring on it —
                    // the same "row 1 looks pre-chosen" problem FilterCombobox avoids. Nothing
                    // here needs focus on open; Tab still walks the rows.
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    className={cn("min-w-(--radix-popover-trigger-width) p-1 shadow-2xl flex flex-col gap-0.5", FILTER_DROPDOWN_WIDTH)}
                >
                    {FILE_TYPE_OPTIONS.map((fileType) => {
                        const IconComponent = fileType.icon
                        const checked = selected.includes(fileType.id)
                        return (
                            <button
                                key={fileType.id}
                                type="button"
                                // Rows stay open on click — picking several types in one
                                // visit is the point of a multi-select.
                                onClick={() => toggleFileType(fileType.id)}
                                // Checked rows sit at gray-2 and darken to gray-3 on hover —
                                // the base hover would otherwise lighten them.
                                className={cn(FILTER_ITEM_STYLES, "w-full", checked && "bg-surface-gray-2 hover:bg-surface-gray-3")}
                            >
                                {/* The row itself is the hit target; the box only reflects state. */}
                                <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                                <IconComponent className={cn("size-4 shrink-0", checked ? "text-ink-gray-8" : "text-ink-gray-4")} />
                                <span className="min-w-0 flex-1 truncate text-left leading-snug">{_(fileType.label)}</span>
                            </button>
                        )
                    })}
                    {/* No "select all": ticking every box filters to every type, which is what
                        an empty selection already does. Clear is the only real action, and it
                        only appears once there's something to clear. The separator is full-bleed
                        (-mx-1 cancels the popover's p-1). */}
                    {checkedCount > 0 && (
                        <>
                            <div className="-mx-1 my-1 h-px bg-outline-gray-2" />
                            <button
                                type="button"
                                onClick={() => onValueChange([])}
                                className={cn(FILTER_ITEM_STYLES, "w-full")}
                            >
                                <XIcon className="size-4 shrink-0 text-ink-gray-5" />
                                {_("Clear")}
                            </button>
                        </>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    )
}
