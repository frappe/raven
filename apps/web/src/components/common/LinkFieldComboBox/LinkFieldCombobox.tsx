import { useDocType } from "@hooks/useDocType";
import { getSystemDefault, slug } from "@lib/frappe";
import { Filter, useFrappeGetCall } from "frappe-react-sdk"
import { memo, useMemo, useRef, useState } from "react";
import { canCreateDocument } from "@lib/permissions";
import { useDebounceValue } from "usehooks-ts";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover";
import { DrawerClose, DrawerContent, DrawerDescription, DrawerNested, DrawerTitle, DrawerTrigger } from "@components/ui/drawer";
import { FormControl } from "@components/ui/form"
import { ChevronDownIcon, ExternalLink } from "lucide-react";
import { Button } from "@components/ui/button";
import { cn } from "@lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@components/ui/command";
import { FilterComboboxItem, FILTER_ITEM_STYLES, FILTER_TRIGGER_STYLES, PAGE_GUTTER } from "@components/common/filters/FilterCombobox";
import { useIsMobile } from "@hooks/use-mobile";
import { useNoDragWhileScrolled } from "@hooks/useNoDragWhileScrolled";
import _ from "@lib/translate";
import ErrorBanner from "@components/ui/error-banner";
import { Skeleton } from "@components/ui/skeleton";
import MarkdownRenderer from "@components/ui/markdown";

export interface ResultItem {
    value: string,
    description: string,
    label?: string
}

/**
 * FILTER_ITEM_STYLES sized for a single line — a channel or user name. This combobox's
 * rows carry a label AND a description ("Sales Invoice" over "Accounts"), so the fixed
 * h-7.5 would clip the second line. h-14 keeps every row here — suggestions, results,
 * and the "Create New" row — on one consistent grid instead: roughly double a one-line
 * row plus its own breathing room, rounded to a clean 4px step.
 */
const LINK_ITEM_STYLES = cn(FILTER_ITEM_STYLES, "h-auto my-0.5")

/**
 * A row's text: two MarkdownRenderer passes per row, across up to 50 rows —
 * memoized so re-renders that don't change the result set (the cmdk highlight
 * moving, open/close state, parent form re-renders) skip re-parsing markdown.
 * SWR hands back the same result array between such renders, so the default
 * shallow compare on `item` is what makes the memo actually hit; a new search
 * result is a new object and re-renders as it must.
 */
const LinkItemContent = memo(({ item }: { item: ResultItem }) => (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="truncate text-base-medium text-ink-gray-7"><MarkdownRenderer content={item.label || item.value} /></span>
        {item.description && item.description !== (item.label || item.value) && (
            <span className="truncate text-p-xs text-ink-gray-4">
                <MarkdownRenderer content={item.description} />
            </span>
        )}
    </div>
))

export interface LinkFieldComboboxProps {
    /** DocType to be fetched */
    doctype: string;
    /** Filters to be applied. Default: none */
    filters?: Filter[]
    /** Number of records to paginate with. Default: Comes from System Settings or 10 */
    limit?: number;
    /**
   * API to call to fetch records.
   *
   * Default: `frappe.desk.search.search_link`
   *
   * If you want to use a custom API, you can pass the path to the API here.
   *
   * The API should return a list of documents in the following format:
   * [{value: string, description: string, label?: string}] - where the value is the ID of the document.
   *
   * If the API sends a label, it will be used as the label in the dropdown.
  */
    searchAPIPath?: string;
    /**
    * Field you want to search against in the doctype.
    *
    * Default: `name`
    *
    * If you want to search against a different field, you can pass the fieldname here.
    *
    * If you want to search against multiple fields, you can try using the `searchAPIPath` prop to call a custom API,
    * or use a custom query in the `customQuery` prop.
    */
    searchfield?: string;
    /**
     * Custom query to be used to fetch records.
     *
     * If you want to use a custom query, you can pass the query here.
     *
     * The query should be in the following format:
     * {
     *  query: string,
     *  filters: {
     *      fieldname: string,
     *      operator: string,
     *      value: string
     *  }
     * }
     */
    customQuery?: {
        /** Path to function for the query.
         *
         * Refer: Item/Supplier query
         */
        query: string,
        /** Filters are usually an object instead of an array in a custom query */
        filters?: Record<string, string | number | boolean>,
    },
    /**
     * Used for certain queries where a reference doctype is needed.
     *
     * For example when searching a supplier in a "Purchase Invoice", the reference_doctype is "Purchase Invoice"
     */
    reference_doctype?: string,
    /** Placeholder for the dropdown. Default: `doctype` */
    placeholder?: string;
    /**
     * Should the field be read-only.
     */
    readOnly?: boolean;
    /** Should the field be disabled. Default: false */
    disabled?: boolean;
    /**
    * Function to filter the options based on the input value/other criteria.
    *
    * For example, you might want to limit the companies shown in the dropdown since they have been already added (like in Cost Codes)
    */
    filterFn?: (option: ResultItem, inputValue: string) => boolean,
    /**
     * Items listed above the search results while the input is empty — e.g. the
     * doctypes this user picked recently. They are not filtered client-side; they
     * simply give way to real results as soon as the user types.
     */
    suggestedItems?: ResultItem[],
    value?: string,
    onChange: (value: string) => void,
    /** If true, the component will be wrapped in a FormControl component */
    useInForm?: boolean,
    /** Button Class name */
    buttonClassName?: string
}
const LinkFieldCombobox = ({
    doctype,
    reference_doctype,
    filters = [],
    value,
    onChange,
    readOnly,
    disabled,
    filterFn,
    suggestedItems,
    placeholder = `Select ${doctype}`,
    customQuery,
    searchfield,
    searchAPIPath = "frappe.desk.search.search_link",
    limit,
    useInForm,
    buttonClassName
}: LinkFieldComboboxProps) => {

    const pageLimit = useMemo(() => limit || getSystemDefault('link_field_results_limit') || 20, [limit])

    /** Load the Doctype meta so that we can determine the search fields + the name of the title field */
    const { data: meta } = useDocType(doctype)

    const userCanCreate = useMemo(() => canCreateDocument(doctype), [doctype])

    const [open, setOpen] = useState(false)
    /** The mobile drawer's hidden close button — see onSelect. */
    const closeRef = useRef<HTMLButtonElement>(null)
    /** The mobile drawer's list wrapper — carries data-vaul-no-drag only while scrolled. */
    const noDragProps = useNoDragWhileScrolled()
    const isMobile = useIsMobile()

    const [searchInput, setSearchInput] = useDebounceValue('', 400)

    const { data: linkTitleData } = useFrappeGetCall('frappe.client.get_value', {
        doctype,
        filters: JSON.stringify({
            name: value
        }),
        fieldname: meta?.title_field
    }, (meta?.show_title_field_in_link ?? false) && (meta?.title_field) && value ? `link_title::${doctype}::${value}` : null, {
        revalidateIfStale: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    })

    const linkTitle = meta?.title_field && meta?.show_title_field_in_link ? (linkTitleData?.message?.[meta?.title_field] ?? value) : value

    // Resolved server-side, not hand-built: Frappe apps that don't live under /app (Frappe
    // CRM leads are at /crm/leads/…) need document_link.get's `raven_document_link_override`
    // hook to rewrite this, which a client-built `/app/<doctype>/<name>` URL can't do.
    // with_site_url: false keeps it RELATIVE so it opens on the origin the user is on —
    // the absolute form comes from the site's configured host_name, which is the deployed
    // hostname and would send a dev machine to production.
    const { data: documentLinkData } = useFrappeGetCall<{ message: string }>('raven.api.document_link.get', {
        doctype,
        docname: value,
        with_site_url: false,
    }, value ? `document_link::${doctype}::${value}` : null)
    const documentLink = documentLinkData?.message

    const { data, error, isLoading } = useFrappeGetCall<{ message: ResultItem[] }>(searchAPIPath, {
        doctype,
        txt: searchInput,
        page_length: pageLimit,
        query: customQuery?.query,
        searchfield,
        filters: JSON.stringify(customQuery?.filters || filters || []),
        reference_doctype,
    }, () => {
        if (!open) {
            return null
        } else {
            let key = `${searchAPIPath}_${doctype}_${searchInput}`

            if (pageLimit) {
                key += `_${pageLimit}`
            }

            if (customQuery?.filters) {
                key += `_${JSON.stringify(customQuery.filters)}`
            } else if (filters) {
                key += `_${JSON.stringify(filters)}`
            }

            if (customQuery && customQuery.query) {
                key += `_${customQuery.query}`
            }

            if (reference_doctype) {
                key += `_${reference_doctype}`
            }

            if (searchfield && searchfield !== 'name') {
                key += `_${searchfield}`
            }

            return key

        }
    }, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        shouldRetryOnError: false,
        revalidateOnReconnect: false,
    })

    const onOpenChange = (open: boolean) => {
        if (readOnly) return
        setOpen(open)
        setSearchInput("")
    }

    const onSelect = (selectedValue: string) => {
        onChange?.(selectedValue)
        // Mobile picks close the DRAWER — and a programmatic setOpen(false) on a
        // nested vaul drawer skips closeDrawer(), leaving the parent sheet (the
        // attach/run-action dialogs host this field) scaled back. Clicking the
        // hidden DrawerClose routes through vaul's own close path instead — the
        // same fix as the search filter drill-ins.
        if (isMobile) closeRef.current?.click()
        else setOpen(false)
    }

    const items = filterFn ? data?.message?.slice(0, 50).filter((item) => filterFn(item, searchInput)) : data?.message

    // Shared by the "Recent" group and the search results — keeps both lists on the
    // same row treatment and the same selected-row check.
    const renderItem = (item: ResultItem, keyPrefix = "") => (
        <FilterComboboxItem
            key={`${keyPrefix}${item.value}`}
            value={item.value}
            selected={value === item.value}
            onSelect={() => onSelect(item.value)}
            className={LINK_ITEM_STYLES}
        >
            <LinkItemContent item={item} />
        </FilterComboboxItem>
    )

    // The trigger is identical for both shells (popover on desktop, drawer on
    // mobile), so it's built once and handed to whichever *Trigger wraps it.
    const trigger = useInForm ? (
        <FormControl>
            <Button
                variant="subtle"
                size="sm"
                role="combobox"
                tabIndex={0}
                disabled={disabled}
                aria-expanded={open}
                // FILTER_TRIGGER_STYLES sizes the trigger to fit its row (w-fit) — this
                // one is a form field instead, so w-full overrides just the width half
                // of that pairing. `group` scopes the hover-revealed external link
                // below. subtle's own bg is already gray-2, so read-only dims the label
                // rather than swapping in a background that would look identical to the
                // normal state.
                className={cn(FILTER_TRIGGER_STYLES, "group w-full", readOnly && "text-ink-gray-5", buttonClassName)}>
                <span className={cn("min-w-0 flex-1 truncate text-left", !linkTitle && "text-ink-gray-4")}>
                    {linkTitle || placeholder}
                </span>

                <div className="flex items-center gap-1">
                    {/* Only once a document is actually selected — a bare chevron already
                        says "open this picker", so the external-link affordance stays
                        hidden until there's somewhere else for it to go. */}
                    {value && documentLink && (
                        <a href={documentLink} target="_blank" className="hidden group-hover:block">
                            <ExternalLink className="size-4 shrink-0 text-ink-gray-5" />
                        </a>
                    )}
                    <ChevronDownIcon className="size-4 shrink-0 text-ink-gray-4" />
                </div>
            </Button>
        </FormControl>
    ) : (
        <Button
            variant="subtle"
            size="sm"
            role="combobox"
            disabled={disabled}
            aria-expanded={open}
            className={cn(FILTER_TRIGGER_STYLES, "w-full", readOnly && "text-ink-gray-5", buttonClassName)}>
            <span className={cn("min-w-0 flex-1 truncate text-left", !value && "text-ink-gray-4")}>
                {value || placeholder}
            </span>

            <ChevronDownIcon className="size-4 shrink-0 text-ink-gray-4" />
        </Button>
    )

    // Search field + result list, shared by both shells. The list's sizing is the
    // one thing that differs: the popover caps its own height (the list just fills
    // it), while the drawer hands the list a flex slot to scroll inside.
    const picker = (listClassName: string) => (
        <>
            {error && <ErrorBanner error={error} />}
            {/* bg-transparent: Command defaults to elevation-1, which would paint over
                the popover's elevation-2. */}
            <Command shouldFilter={false} className="min-h-0 flex-1 bg-transparent">
                {/* Espresso's Input pairs a size with a type step; the plain variant plus
                    text-base keeps the taller box on mobile for touch. See FilterCombobox. */}
                <CommandInput
                    variant="plain"
                    placeholder={placeholder}
                    onValueChange={setSearchInput}
                    className="text-base"
                />
                <CommandList className={listClassName}>
                    {/* Hidden while results load — the skeleton below owns that state.
                        A bare "Loading..." line read as a hang in the drawer sheet. */}
                    {!isLoading && <CommandEmpty>{_("No results found.")}</CommandEmpty>}
                    {!searchInput && suggestedItems && suggestedItems.length > 0 && (
                        <CommandGroup heading={_("Recent")}>
                            {suggestedItems.map((item) => renderItem(item, "recent-"))}
                        </CommandGroup>
                    )}
                    {isLoading && !items?.length && (
                        <div className="flex flex-col p-1" aria-hidden="true">
                            {Array.from({ length: 8 }, (unused, i) => (
                                <div key={i} className="flex h-9 items-center px-3">
                                    <Skeleton className={cn("h-4", i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-1/2" : "w-2/3")} />
                                </div>
                            ))}
                        </div>
                    )}
                    <CommandGroup>
                        {items?.map((result) => renderItem(result))}
                        {userCanCreate && (
                            <CommandItem asChild className={cn(LINK_ITEM_STYLES, "justify-between")}>
                                {/* No equivalent endpoint exists for "create a new document" the
                                    way document_link.get resolves an existing one, so this still
                                    hand-builds a /desk/ URL — wrong for a doctype whose app lives
                                    elsewhere (e.g. Frappe CRM). Left as-is until such an endpoint
                                    exists. */}
                                <a href={`/desk/${slug(doctype)}/new-${slug(doctype)}-1`} target="_blank">
                                    {_("Create New {0}", [doctype])}
                                    <ExternalLink />
                                </a>
                            </CommandItem>
                        )}
                    </CommandGroup>
                </CommandList>
            </Command>
        </>
    )

    // Mobile: a nested bottom sheet, the drill-in pattern the search filters use —
    // a popover floating over a sheet fights the keyboard and the sheet's edges.
    // DrawerNested stacks properly when a parent drawer hosts this field (the
    // attach/run-action dialogs) and degrades to a plain drawer when none does.
    // Fixed height so the sheet doesn't jump as the list filters down.
    if (isMobile) {
        return (
            <DrawerNested open={open} onOpenChange={onOpenChange}>
                {/* No disabled/readOnly handling here — the trigger button carries
                    `disabled` itself, and readOnly is enforced in onOpenChange (same
                    as the popover), keeping the read-only look distinct from disabled. */}
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                <DrawerContent
                    className="h-[85dvh]"
                    // Radix focuses the search field on open — the keyboard would cover
                    // the list it's meant to filter. Same rule as the popover below.
                    onOpenAutoFocus={(event) => event.preventDefault()}
                >
                    <DrawerTitle className="px-4 pb-2 pt-1 text-left">{placeholder}</DrawerTitle>
                    <DrawerDescription className="sr-only">{_("Search and pick a document")}</DrawerDescription>
                    {/* Programmatic closes go through this (see onSelect): vaul unscales
                        the PARENT sheet only on its own close path. */}
                    <DrawerClose ref={closeRef} className="hidden" />
                    {/* Positional no-drag (see useNoDragWhileScrolled): swipes scroll the
                        list while it's scrolled, and pull the sheet closed from the top. */}
                    <div {...noDragProps} className="flex min-h-0 flex-1 flex-col pb-4">
                        {picker("max-h-none min-h-0 flex-1")}
                    </div>
                </DrawerContent>
            </DrawerNested>
        )
    }

    return (
        <Popover open={open} onOpenChange={onOpenChange} modal={true}>
            <PopoverTrigger asChild>
                {trigger}
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                // Same reasoning as FilterCombobox: keeps the popover off the screen edge
                // when the field sits near it, e.g. in a narrow dialog.
                collisionPadding={PAGE_GUTTER}
                // Collision avoidance ON (the default): the field can sit LOW on the
                // screen — the docname picker in the attach/run-action bottom sheets —
                // and there the height cap alone squeezed the always-below list into a
                // sliver. Flipping above is the only usable answer. This used to be
                // disabled over a close glitch (Radix re-measuring mid-exit snapped a
                // flipped popover back down as it faded); the search reset that caused
                // the mid-exit re-render is debounced past the exit animation now, so
                // the content holds still while it fades.
                // min-w matches the field's own width (like a native select); shadow-2xl
                // matches DropdownMenuContent's elevation. The max-h pair caps the popover
                // at whatever Radix measures below the trigger, never more than 18rem —
                // the list inside scrolls rather than the popover growing.
                className={cn(
                    "flex min-w-(--radix-popover-trigger-width) flex-col p-0 shadow-2xl",
                    "max-h-[min(18rem,var(--radix-popover-content-available-height))]",
                )}
            >
                {/* max-h-none hands height control to the popover's cap above — cmdk's own
                    300px default would otherwise let the list outgrow the space Radix
                    measured, which is what forces a flip in the first place. */}
                {picker("max-h-none")}
            </PopoverContent>

        </Popover>
    )
}

export default LinkFieldCombobox
