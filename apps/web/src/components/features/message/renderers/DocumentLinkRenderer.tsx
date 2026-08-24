import { Fragment, useContext, useMemo, useState } from "react"
import parse from "html-react-parser"
import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
import { FrappeContext, useFrappeGetCall, type FrappeConfig } from "frappe-react-sdk"
import { toast } from "sonner"
import {
    ArrowDownIcon,
    ArrowRightIcon,
    ArrowUpIcon,
    CheckIcon,
    FileBoxIcon,
    OctagonAlertIcon,
    CopyIcon,
    MinusIcon,
    PrinterIcon,
    WorkflowIcon,
} from "lucide-react"
import { cn } from "@lib/utils"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { Skeleton } from "@components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { errorResponseToast } from "@components/ui/error-banner"
import { useHasBeenInView } from "@hooks/useHasBeenInView"
import {
    fieldByLabel,
    previewRowCountOf,
    useDoctypeMeta,
    type DoctypeMeta,
    type WorkflowMeta,
} from "@hooks/useDoctypeMeta"
import { useUsersById } from "@hooks/useMessageRowLookups"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { slug } from "@lib/frappe"
import { USER_DATE_FORMAT } from "@lib/date"
import { DocumentPrintDialog } from "./DocumentPrintDialog"
import _ from "@lib/translate"

// For best-effort parsing of server-formatted dates back into dayjs (tooltips).
dayjs.extend(customParseFormat)

/** Keys of get_preview_data's response that are card chrome, not field rows. */
const PREVIEW_META_KEYS = new Set(["preview_image", "preview_title", "id", "raven_document_link"])

type PreviewData = Record<string, string | number | null> & {
    preview_image?: string
    preview_title?: string
    id?: string
    raven_document_link?: string
}

type BadgeTheme = "gray" | "blue" | "green" | "amber" | "red" | "violet"

/**
 * Desk's indicator conventions, so a status badge in chat matches the color
 * the user already knows from list views. Keys keep their canonical casing —
 * that is what the translation catalog is keyed by (see lookupBuilder below).
 */
const SELECT_VALUE_THEMES: Record<string, BadgeTheme> = {
    Active: "green",
    Enabled: "green",
    Paid: "green",
    Approved: "green",
    Completed: "green",
    Complete: "green",
    Success: "green",
    Submitted: "green",
    Open: "blue",
    "In Progress": "blue",
    Running: "blue",
    Pending: "amber",
    "On Hold": "amber",
    "In Review": "amber",
    "Partly Paid": "amber",
    Draft: "gray",
    Closed: "gray",
    Cancelled: "red",
    Inactive: "red",
    Rejected: "red",
    Failed: "red",
    Error: "red",
    Overdue: "red",
}

/** Hardcoded treatment for any field LABELED like a priority (Jira-style). */
const PRIORITY_BADGES: Record<string, { theme: BadgeTheme; icon: typeof ArrowUpIcon }> = {
    Urgent: { theme: "red", icon: OctagonAlertIcon },
    High: { theme: "red", icon: ArrowUpIcon },
    Medium: { theme: "amber", icon: MinusIcon },
    Low: { theme: "gray", icon: ArrowDownIcon },
}

/**
 * Values arrive TRANSLATED from the server (frappe.format runs with
 * translated=True). The client loads the same translation catalog, so
 * translating our English keys through _() reproduces the exact strings the
 * server sends. Each map's lookup indexes both the English key and its
 * translation, lowercased. Built once, on first use — the language is fixed
 * for the session.
 */
const lookupBuilder = <T,>(source: Record<string, T>) => {
    let index: Map<string, T> | null = null
    return (value: string): T | undefined => {
        if (!index) {
            index = new Map()
            for (const [english, entry] of Object.entries(source)) {
                index.set(english.toLowerCase(), entry)
                index.set(_(english).toLowerCase(), entry)
            }
        }
        return index.get(value.toLowerCase())
    }
}

const selectThemeFor = lookupBuilder(SELECT_VALUE_THEMES)
const priorityBadgeFor = lookupBuilder(PRIORITY_BADGES)

/** Fieldtypes whose values legitimately carry markup worth rendering. */
const HTML_FIELDTYPES = new Set(["Text Editor", "HTML Editor", "Small Text", "Long Text", "Markdown Editor"])

const NUMERIC_FIELDTYPES = new Set(["Currency", "Float", "Int", "Percent", "Duration"])

/** URL schemes allowed on links and images. Everything else is dropped —
 *  javascript:, data:, vbscript:, and any scheme hidden by encoded characters. */
const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i

/** Attributes that carry URLs. All of them must pass SAFE_URL. */
const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction"])

/** Elements removed outright. `template` matters: its children live in a
 *  detached fragment that querySelectorAll can't see, but innerHTML would
 *  re-serialize — so the whole element must go. */
const BLOCKED_ELEMENTS = "script, style, iframe, object, embed, link, meta, form, base, template, svg, math"

/**
 * Server-formatted values are same-site content, but Data fields are NOT
 * sanitized on save. Strip anything executable before handing the string to
 * html-react-parser. URL attributes use an ALLOWLIST — a denylist is not
 * enough, because entities can hide a tab inside "javascript:" and browsers
 * strip it when navigating.
 */
const sanitizeServerHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, "text/html")
    doc.querySelectorAll(BLOCKED_ELEMENTS).forEach((el) => el.remove())
    doc.body.querySelectorAll("*").forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase()
            // Event handlers, inline styles and srcset can all smuggle code or requests.
            if (name.startsWith("on") || name === "style" || name === "srcset") {
                el.removeAttribute(attr.name)
            } else if (URL_ATTRIBUTES.has(name) && !SAFE_URL.test(attr.value.trim())) {
                el.removeAttribute(attr.name)
            }
        }
    })
    return doc.body.innerHTML
}

/** Sanitize-then-parse: entities decode, benign markup renders, nothing executes. */
const ServerHtml = ({ html, className }: { html: string; className?: string }) => {
    const nodes = useMemo(() => parse(sanitizeServerHtml(html)), [html])
    return <span className={className}>{nodes}</span>
}

/** Fallback route when the preview (and its hook-resolved link) isn't available. */
const defaultDocRoute = (doctype: string, docname: string) =>
    `${window.location.origin}/desk/${slug(doctype)}/${encodeURIComponent(docname)}`

/** One cache entry per document, shared by the card AND the composer's staged
 *  chip — the chip pre-warms exactly what the sent card will read. */
export const documentPreviewSwrKey = (doctype: string, docname: string) =>
    `doctype_preview::${doctype}::${docname}`

/**
 * A message's linked document (link_doctype/link_document on Raven Message) as
 * a card. Meta is fetched EAGERLY — it's one cached request per doctype per
 * session and makes the skeleton match the real card's shape (row count,
 * image box). The preview DATA waits for visibility, poll-style, so a channel
 * full of linked documents only fetches what the user actually sees.
 */
export const DocumentLinkRenderer = ({ doctype, docname }: { doctype: string; docname: string }) => {
    const { meta, workflowDoc } = useDoctypeMeta(doctype)
    const { ref, hasBeenInView } = useHasBeenInView()

    return (
        <div ref={ref} className="w-full max-w-xl py-1">
            {hasBeenInView ? (
                <LoadedDocumentLink doctype={doctype} docname={docname} meta={meta} workflowDoc={workflowDoc} />
            ) : (
                <DocumentLinkSkeleton meta={meta} />
            )}
        </div>
    )
}

const cardSurface =
    "rounded-md border border-outline-gray-2 bg-surface-base dark:bg-surface-elevation-1 p-3"

/** Approximate 3 rows until meta lands; meta-accurate after (one paint later,
 *  and instant for every later card of the same doctype). */
const DocumentLinkSkeleton = ({ meta }: { meta?: DoctypeMeta }) => {
    const rows = meta ? Math.min(Math.max(previewRowCountOf(meta), 1), 6) : 3
    return (
        <div className={`${cardSurface} flex flex-col gap-2.5`}>
            <div className="flex items-center gap-2.5">
                {meta?.image_field && <Skeleton className="size-10 shrink-0 rounded-md" />}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-48 max-w-full" />
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                {Array.from({ length: rows }, (unused, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-3.5 w-24 shrink-0" />
                        <Skeleton className="h-3.5 w-32" />
                    </div>
                ))}
            </div>
        </div>
    )
}

/** Deleted doc / no permission: a quiet reference, not an error box in chat. */
const DocumentLinkFallback = ({ doctype, docname }: { doctype: string; docname: string }) => (
    <div className={`${cardSurface} flex items-center gap-2`}>
        <Badge variant="outline" theme="gray">
            {doctype}
        </Badge>
        <a
            href={defaultDocRoute(doctype, docname)}
            target="_blank"
            rel="noreferrer"
            className="truncate text-p-sm text-ink-gray-7 hover:underline"
        >
            {docname}
        </a>
    </div>
)

const LoadedDocumentLink = ({
    doctype,
    docname,
    meta,
    workflowDoc,
}: {
    doctype: string
    docname: string
    meta?: DoctypeMeta
    workflowDoc?: WorkflowMeta
}) => {
    // Only mounted once the row is in view, so the fetch fires lazily. Document
    // data goes stale (edits, workflow moves elsewhere) — let SWR revalidate on
    // focus and on remount, throttled like the poll cards.
    const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: PreviewData | null }>(
        "raven.api.document_link.get_preview_data",
        { doctype, docname },
        documentPreviewSwrKey(doctype, docname),
        { dedupingInterval: 10000, focusThrottleInterval: 5000, shouldRetryOnError: false },
    )

    if (isLoading) return <DocumentLinkSkeleton meta={meta} />
    const preview = data?.message
    if (error || !preview) return <DocumentLinkFallback doctype={doctype} docname={docname} />
    return (
        <DocumentCard
            doctype={doctype}
            docname={docname}
            preview={preview}
            meta={meta}
            workflowDoc={workflowDoc}
            onDocumentChanged={() => mutate()}
        />
    )
}

const DocumentCard = ({
    doctype,
    docname,
    preview,
    meta,
    workflowDoc,
    onDocumentChanged,
}: {
    doctype: string
    docname: string
    preview: PreviewData
    meta?: DoctypeMeta
    workflowDoc?: WorkflowMeta
    onDocumentChanged: () => void
}) => {
    const route = preview.raven_document_link || defaultDocRoute(doctype, docname)
    // The print dialog can't live inside the menu (items unmount on select) —
    // controlled sibling, mounted only while open so the iframe stays lazy.
    const [printOpen, setPrintOpen] = useState(false)

    const copyLink = () => {
        navigator.clipboard
            .writeText(route)
            .then(() => toast.success(_("Link copied")))
            .catch(() => toast.error(_("Could not copy link")))
    }

    const copyId = () => {
        if (!preview.id) return
        navigator.clipboard
            .writeText(String(preview.id))
            .then(() => toast.success(_("ID copied")))
            .catch(() => toast.error(_("Could not copy ID")))
    }

    return (
        <div className={`${cardSurface} flex flex-col gap-2.5`}>
            <div className="flex items-start gap-2.5">
                {preview.preview_image && (
                    // Explicit square box so the image can't shift the card as it loads.
                    <img
                        src={preview.preview_image}
                        alt=""
                        loading="lazy"
                        className="size-10 shrink-0 rounded-md bg-surface-gray-3 object-cover"
                    />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                        <Badge variant="subtle" theme="gray">
                            {doctype}
                        </Badge>
                        {preview.id && (
                            <button
                                type="button"
                                onClick={copyId}
                                title={_("Copy ID")}
                                className="cursor-copy truncate text-p-xs text-ink-gray-5"
                            >
                                {preview.id}
                            </button>
                        )}
                    </div>
                    <a
                        href={route}
                        target="_blank"
                        rel="noreferrer"
                        className="w-fit max-w-full truncate text-p-base font-medium text-ink-gray-8 hover:underline"
                    >
                        {/* Parsed like values: titles inherit whatever the title field holds. */}
                        <ServerHtml html={String(preview.preview_title ?? docname)} />
                    </a>
                </div>
                {/* Flat action row — every action is one click. The only dropdown
                    left is Workflow, whose options are per-document by nature. */}
                <div className="flex shrink-0 items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" isIconButton aria-label={_("Copy link")} onClick={copyLink}>
                                <CopyIcon />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{_("Copy link")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" isIconButton aria-label={_("Print")} onClick={() => setPrintOpen(true)}>
                                <PrinterIcon />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{_("Print")}</TooltipContent>
                    </Tooltip>
                    {workflowDoc && (
                        <WorkflowMenu doctype={doctype} docname={docname} onApplied={onDocumentChanged} />
                    )}
                </div>
            </div>

            <DocumentFieldsGrid preview={preview} meta={meta} />

            {printOpen && (
                <DocumentPrintDialog
                    doctype={doctype}
                    docname={docname}
                    meta={meta}
                    open={printOpen}
                    onOpenChange={setPrintOpen}
                />
            )}
        </div>
    )
}

/** The label/value rows of a preview. Shared by the message card and the
 *  composer chip's hover preview. */
const DocumentFieldsGrid = ({ preview, meta }: { preview: PreviewData; meta?: DoctypeMeta }) => {
    const fields = useMemo(
        () =>
            Object.entries(preview).filter(
                ([key, value]) => !PREVIEW_META_KEYS.has(key) && value !== null && value !== undefined && value !== "",
            ),
        [preview],
    )
    if (fields.length === 0) return null
    return (
        <div className="grid grid-cols-[minmax(5rem,auto)_1fr] items-baseline gap-x-4 gap-y-1.5">
            {fields.map(([label, value]) => (
                <Fragment key={label}>
                    <span className="truncate text-p-sm text-ink-gray-5">{label}</span>
                    <div className="min-w-0 text-p-sm text-ink-gray-8">
                        <FieldValue label={label} value={value!} meta={meta} />
                    </div>
                </Fragment>
            ))}
        </div>
    )
}

/**
 * Read-only preview (header + fields, no actions) for the composer chip's
 * hover card. Reads the same caches as the full card, so it's usually instant.
 */
export const DocumentPreviewSummary = ({ doctype, docname }: { doctype: string; docname: string }) => {
    const { meta } = useDoctypeMeta(doctype)
    const { data, isLoading } = useFrappeGetCall<{ message: PreviewData | null }>(
        "raven.api.document_link.get_preview_data",
        { doctype, docname },
        documentPreviewSwrKey(doctype, docname),
        { dedupingInterval: 10000, focusThrottleInterval: 5000, shouldRetryOnError: false },
    )

    const preview = data?.message
    if (isLoading || !preview) {
        return (
            <div className="flex items-center gap-2">
                <Badge variant="subtle" theme="gray">
                    {doctype}
                </Badge>
                <span className="truncate text-p-sm text-ink-gray-7">{docname}</span>
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
                {preview.preview_image && (
                    <img
                        src={preview.preview_image}
                        alt=""
                        loading="lazy"
                        className="size-10 shrink-0 rounded-md bg-surface-gray-3 object-cover"
                    />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                        <Badge variant="subtle" theme="gray">
                            {doctype}
                        </Badge>
                        {preview.id && <span className="truncate text-p-xs text-ink-gray-5">{preview.id}</span>}
                    </div>
                    <span className="w-fit max-w-full truncate text-p-base font-medium text-ink-gray-8">
                        <ServerHtml html={String(preview.preview_title ?? docname)} />
                    </span>
                </div>
            </div>
            <DocumentFieldsGrid preview={preview} meta={meta} />
        </div>
    )
}

/**
 * Compact one-line reference (icon + doctype + id) for dense surfaces: the
 * collapsed thread header and thread-list rows. The full card stays for
 * message and expanded-thread surfaces.
 */
export const DocumentLinkInline = ({
    doctype,
    docname,
    className,
}: {
    doctype: string
    docname: string
    className?: string
}) => (
    <p className={cn("flex min-w-0 items-center gap-1 text-sm text-ink-gray-5", className)}>
        <FileBoxIcon className="size-3.5 shrink-0" />
        <span className="truncate">
            {doctype} · {docname}
        </span>
    </p>
)

/**
 * One value, rendered by its FIELDTYPE (joined back through meta by label).
 * Label-based overrides (Priority) run first; unknown types fall through to
 * plain text — the card never breaks on an exotic field.
 */
const FieldValue = ({
    label,
    value,
    meta,
}: {
    label: string
    value: string | number
    meta?: DoctypeMeta
}) => {
    const text = String(value)
    const field = meta ? fieldByLabel(meta, label) : undefined

    if (/priority/i.test(label)) {
        const priority = priorityBadgeFor(text)
        if (priority) {
            return (
                <Badge variant="subtle" theme={priority.theme}>
                    <priority.icon />
                    {text}
                </Badge>
            )
        }
    }

    switch (field?.fieldtype) {
        case "Select":
            return (
                <Badge variant="subtle" theme={selectThemeFor(text) ?? "gray"}>
                    {text}
                </Badge>
            )
        case "Check":
            // Falsy values never arrive (the backend skips them) — a row here means checked.
            return <CheckIcon aria-label={_("Yes")} className="size-4 text-ink-green-8" />
        case "Link":
            if (field.options === "User" || field.options === "Raven User") return <UserValue id={text} />
            return <span className="break-words">{text}</span>
        case "Date":
        case "Datetime":
            return <DateValue text={text} isDatetime={field.fieldtype === "Datetime"} />
        default:
            if (field && NUMERIC_FIELDTYPES.has(field.fieldtype)) {
                return <span className="tabular-nums">{text}</span>
            }
            if (field && HTML_FIELDTYPES.has(field.fieldtype)) {
                return <ServerHtml html={text} className="break-words [&_a]:text-ink-blue-8 [&_a]:hover:underline" />
            }
            return <span className="break-words">{text}</span>
    }
}

/** User-type links render as the person, not their email. Falls back to the
 *  raw value for users Raven doesn't know (deactivated, non-Raven). */
const UserValue = ({ id }: { id: string }) => {
    const usersById = useUsersById()
    const user = usersById.get(id)
    if (!user) return <span className="break-words">{id}</span>
    return (
        // Inline flow on purpose, not inline-flex. A flex chip takes its
        // baseline from its first item. That item is the avatar image, and an
        // image's baseline is its bottom edge. The grid aligns baselines, so
        // the label sat on the avatar's bottom and the name floated high.
        // As a middle-aligned inline box, the avatar stays out of it: the
        // cell's baseline is the name's own text baseline.
        <span className="break-words">
            <span className="mr-1.5 inline-block size-5 align-middle">
                <UserAvatar user={user} size="xs" />
            </span>
            {user.full_name}
        </span>
    )
}

/**
 * Server-formatted date, with a best-effort relative tooltip ("in 6 days").
 * The server sends display strings, so we parse them back with the site's
 * date format; if that fails (custom formats), the tooltip just doesn't show.
 */
const DateValue = ({ text, isDatetime }: { text: string; isDatetime: boolean }) => {
    const relative = useMemo(() => {
        // The server formats with the USER's date format when one is set (and
        // the site default otherwise) — parse with the same preference, or an
        // ambiguous "03-04" swaps day and month and the tooltip is wrong.
        if (isDatetime) {
            const parsed = dayjs(text, [`${USER_DATE_FORMAT} HH:mm:ss`, USER_DATE_FORMAT])
            return parsed.isValid() ? parsed.fromNow() : null
        }
        // Date-only values parse to midnight, so fromNow() would speak in hours
        // ("in 14 hours" for tomorrow). A date means the DAY — compare whole days.
        const parsed = dayjs(text, [USER_DATE_FORMAT])
        if (!parsed.isValid()) return null
        const days = parsed.startOf("day").diff(dayjs().startOf("day"), "day")
        if (days === 0) return _("Today")
        if (days === 1) return _("Tomorrow")
        if (days === -1) return _("Yesterday")
        return parsed.startOf("day").from(dayjs().startOf("day"))
    }, [text, isDatetime])

    if (!relative) return <span>{text}</span>
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span>{text}</span>
            </TooltipTrigger>
            <TooltipContent>{relative}</TooltipContent>
        </Tooltip>
    )
}

type WorkflowTransition = {
    name: string
    action: string
    state: string
    next_state: string
}

/** The workflow-only dropdown: trigger in the card's action row (rendered only
 *  when the doctype HAS a workflow), transitions as the menu itself. Menu
 *  content mounts on OPEN — that's when the transitions fetch fires, so an
 *  idle card never pays for it. */
const WorkflowMenu = ({
    doctype,
    docname,
    onApplied,
}: {
    doctype: string
    docname: string
    onApplied: () => void
}) => (
    <DropdownMenu>
        <Tooltip>
            <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" isIconButton aria-label={_("Workflow")}>
                        <WorkflowIcon />
                    </Button>
                </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{_("Workflow")}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
            <WorkflowTransitions doctype={doctype} docname={docname} onApplied={onApplied} />
        </DropdownMenuContent>
    </DropdownMenu>
)

const WorkflowTransitions = ({
    doctype,
    docname,
    onApplied,
}: {
    doctype: string
    docname: string
    onApplied: () => void
}) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { data, error, mutate } = useFrappeGetCall<{ message: WorkflowTransition[] }>(
        "frappe.model.workflow.get_transitions",
        { doc: { doctype, name: docname } },
        `workflow_transitions::${doctype}::${docname}`,
        { revalidateOnFocus: false, shouldRetryOnError: false },
    )

    const applyTransition = (action: string) => {
        call
            .post("frappe.model.workflow.apply_workflow", {
                doc: { doctype, name: docname },
                action,
            })
            .then(() => {
                // Both go stale together: the doc's state field and what can happen next.
                onApplied()
                mutate()
                toast.success(_("Workflow updated"))
            })
            .catch((e) => errorResponseToast(_("Could not apply workflow action"), e))
    }

    // A failed fetch (no workflow state on the doc, no read permission) must not
    // read as an endless "Loading..." — retries are off, so say what happened.
    if (error) return <DropdownMenuItem disabled>{_("Could not load workflow actions")}</DropdownMenuItem>
    if (!data) return <DropdownMenuItem disabled>{_("Loading...")}</DropdownMenuItem>
    if (data.message.length === 0) {
        return <DropdownMenuItem disabled>{_("No actions available")}</DropdownMenuItem>
    }
    return (
        <>
            {data.message.map((transition) => (
                <DropdownMenuItem key={transition.name} onSelect={() => applyTransition(transition.action)}>
                    <span className="font-medium">{transition.action}</span>
                    <span className="ml-auto flex items-center gap-1 pl-3 text-p-xs text-ink-gray-5">
                        {transition.state}
                        <ArrowRightIcon className="size-3" />
                        {transition.next_state}
                    </span>
                </DropdownMenuItem>
            ))}
        </>
    )
}
