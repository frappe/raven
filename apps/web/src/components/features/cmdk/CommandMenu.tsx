import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@components/ui/drawer'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@components/ui/command'
import _ from '@lib/translate'
import { defaultFilter } from 'cmdk'
import React, { useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import { ArrowDownIcon, ArrowUpIcon, CornerDownLeftIcon, TextSearch } from 'lucide-react'
import { Kbd, KbdGroup } from '@components/ui/kbd'
import { KeyboardMetaKeyIcon } from '@components/ui/keyboard-keys'
import { useAtom, useSetAtom } from 'jotai'
import ChannelList from './ChannelList'
import UserList from './UserList'
import SettingsList from './SettingsList'
import QuickActions from './CommandList'
import NavigationList from './NavigationList'
import { commandMenuOpenAtom } from './atoms'
import { useHistoryBackClose } from '@hooks/useHistoryBackClose'
import { useChannel } from '@hooks/useChannel'
import { useUser } from '@hooks/useUser'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { useIsMobile } from '@hooks/use-mobile'
import { useLocation } from 'react-router-dom'
import { cn } from '@lib/utils'

/**
 * The palette's departures from the base cmdk components, matched to frappe-ui's
 * docs command palette (the Espresso reference implementation). Scoped here so
 * the filter popovers keep their DropdownMenu-style rows and labels:
 * - groups stack with the reference's rhythm (px-2.5 gutter, mt-4.5 between, mt-3 first)
 * - rows are font-medium with the reference's py-2 height and gray-3 highlight
 * Geometry and states only — the heading TYPE (body-size regular ink-gray-5) is
 * CommandGroup's own default; restating it here with unprefixed utilities made the
 * winner depend on Tailwind's generated order. Where an override DOES fight a base
 * heading utility (py), the selector goes through [cmdk-group] so it wins on
 * specificity, not order.
 */
const PALETTE_OVERRIDES = [
    "[&_[cmdk-group]]:px-2.5 [&_[cmdk-group]]:py-0 [&_[cmdk-group]]:mt-4.5 [&_[cmdk-group]]:mb-2 [&_[cmdk-group]:first-of-type]:mt-3",
    "[&_[cmdk-group]_[cmdk-group-heading]]:py-0 [&_[cmdk-group]_[cmdk-group-heading]]:mb-1.5",
    "[&_[cmdk-item]]:font-medium [&_[cmdk-item]]:py-2 [&_[cmdk-item][data-selected=true]]:bg-surface-gray-3",
].join(" ")

const CommandMenu = () => {
    const [open, setOpen] = useAtom(commandMenuOpenAtom)
    const isMobile = useIsMobile()
    const navigate = useNavigate()

    useHotkeys('mod+k', () => setOpen((open) => !open), {
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
    })

    // ⌘G opens the search page from anywhere (the browser's find-next default
    // is preventable, unlike ⌘T/⌘W). When the palette is OPEN, its own ⌘G
    // handler (in CommandPalette) navigates instead, carrying the typed query
    // — this one stands down so a single press doesn't navigate twice.
    useHotkeys('mod+g', () => {
        if (open) return
        navigate('/search')
    }, {
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
    }, [open, navigate])

    // MOBILE only: the open palette drawer owns the system back gesture
    // (atom-driven overlay above the routes). Every selection closes AND
    // navigates in one handler — the hook's history.state guard is what keeps
    // that from popping the destination. Desktop keeps browser-back as plain
    // navigation (no gesture problem to solve there).
    useHistoryBackClose(isMobile && open, () => setOpen(false))

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent className="h-[90vh] flex flex-col">
                <DrawerTitle className="sr-only">{_("Command menu")}</DrawerTitle>
                    <DrawerDescription className="sr-only">{_("Search or type a command")}</DrawerDescription>
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        <CommandPalette inDrawer />
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                className="w-150 max-w-none sm:max-w-none p-0 gap-0 overflow-hidden [&>button:last-child]:hidden"
                aria-describedby={undefined}
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>{_("Command Menu")}</DialogTitle>
                    <DialogDescription>{_("Search or type a command")}</DialogDescription>
                </DialogHeader>
                <CommandPalette />
            </DialogContent>
        </Dialog>
    )
}

const CommandPalette = ({ inDrawer = false }: { inDrawer?: boolean }) => {
    const [text, setText] = useState('')
    const navigate = useNavigate()
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const location = useLocation()
    const listRef = useRef<HTMLDivElement>(null)

    // The current channel comes from the URL, parsed by hand — NOT useParams:
    // the palette mounts at the AppShell root, and useParams only sees params
    // up to its own route depth, which at the root is always {} (so a
    // params-based scope never appeared at all). The channel sits in the
    // second segment on every route that shows one — /:workspaceID/:id,
    // /dm-channel/:id, and the notification/search/saved chat panes — and the
    // store lookup below validates the candidate, so non-channel segments
    // (a thread id, a message id) simply resolve to nothing.
    const segments = location.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const isDMRoute = segments[0] === 'dm-channel' && !segments[1]
    const channelID = segments[0] === 'settings' ? '' : (segments[1] ?? '')
    const { channel, dmChannel } = useChannel(channelID)
    const peerUser = useUser(dmChannel?.peer_user_id || "")

    const isMobile = useIsMobile()

    // Items set `value` to a UNIQUE id (a channel's "workspaceID-channelName", a user's id, a
    // "settings-…" slug) and put the human-searchable text in `keywords`. cmdk's default filter
    // scores value + keywords together, so the id leaks into matching — e.g. in a "Frappe"
    // workspace every channel id starts with "Frappe-", so searching "frappe" matched them all.
    // Score against keywords ONLY when present (the name/label), falling back to value for items
    // that have none (so the global "Search…" item and anything keyword-less still match).
    const customFilter = (value: string, search: string, keywords?: string[]) =>
        keywords?.length ? defaultFilter(keywords.join(' '), search) : defaultFilter(value, search)

    // The primary "Search for {0}" row's navigation, shared with ⌘G below: the
    // typed query plus the current channel/DM scope go to the search page.
    const goToSearchPage = () => {
        const params = new URLSearchParams()
        if (text) params.set('q', text)
        // Scope only to a VALIDATED channel (the store lookup succeeded),
        // never to a raw URL segment.
        if (channel || dmChannel) params.set('channel', channelID)
        else if (isDMRoute) params.set('is_dm', '1')
        const qs = params.toString()
        navigate(qs ? `/search?${qs}` : '/search')
        setOpen(false)
    }

    // ⌘G with the palette open: the keyboard mirror of the primary search row —
    // whatever is typed goes with you to the search page, same scope rules. The
    // global ⌘G in CommandMenu stands down while the palette is open.
    useHotkeys('mod+g', goToSearchPage, {
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
    }, [text, channelID, channel, dmChannel, isDMRoute])

    return (
        <Command
            label="Global Command Menu"
            filter={customFilter}
            className={cn(PALETTE_OVERRIDES, inDrawer && "flex flex-col flex-1 min-h-0 bg-transparent")}
        >
            <CommandInput
                variant="palette"
                autoFocus={!isMobile}
                value={text}
                onValueChange={(v) => {
                    setText(v.slice(0, 140))
                    // Every keystroke re-filters, but cmdk keeps the list's old
                    // scroll offset — so after scrolling down and typing more, the
                    // auto-selected FIRST result sat above the fold. Jump back to
                    // the top whenever the query changes.
                    listRef.current?.scrollTo({ top: 0 })
                }}
                maxLength={140}
                placeholder={isMobile ? _("Search") : _("Search or type a command")}
            />
            <CommandList ref={listRef} className={inDrawer ? "flex-1 overflow-auto max-h-none pb-6" : "max-h-105"}>
                {/* cmdk ranks items WITHIN a group but never across groups — grouped
                    results always put every user above a better channel match just
                    because the Users section rendered first. So while searching, the
                    lists render their rows BARE (no headings — each row's avatar/#/
                    glyph already says what it is) inside ONE unheaded group: a single
                    ranking pool cmdk sorts globally by score. Browsing (no query)
                    keeps the labeled sections. The scoped Search rows below live in
                    their own near-zero-scoring group, so the group-level sort keeps
                    them pinned after the results either way. */}
                {(() => {
                    const lists = (
                        <>
                            <UserList text={text} />
                            <ChannelList text={text} />
                            {/* Desktop-only, like Settings/Commands: mobile already has the
                                long-press workspace drawer and the footer tabs for these. */}
                            {!isMobile && <NavigationList text={text} />}
                            {!isMobile && <SettingsList text={text} />}
                            {!isMobile && <QuickActions text={text} />}
                        </>
                    )
                    return text ? <CommandGroup>{lists}</CommandGroup> : lists
                })()}
                <CommandGroup forceMount>
                    <CommandItem
                        // Fixed value + forceMount: this is the always-available fallback action.
                        // Its label contains the query, so without a stable non-matching value it
                        // would out-score partial result matches and steal the default highlight.
                        // forceMount keeps it visible regardless; the fixed value keeps its score ~0
                        // so the first real result is auto-selected (and it wins only when nothing
                        // else matches).
                        value="raven-global-search"
                        forceMount
                        onSelect={goToSearchPage}
                        className='cursor-pointer min-w-0'
                    >
                        <TextSearch className="shrink-0" />
                        {channel ? (
                            <ScopedLabel
                                text={text}
                                templateWithText={_("Search for {0} in {1}")}
                                templateNoText={_("Search in {0}")}
                                entity={
                                    <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-0.5">
                                        <ChannelIcon type={channel.type} className="h-4 w-4 shrink-0" />
                                        <span className="font-medium text-ink-gray-8">{channel.channel_name}</span>
                                    </span>
                                }
                            />
                        ) : peerUser ? (
                            <ScopedLabel
                                text={text}
                                templateWithText={_("Search for {0} in DMs with {1}")}
                                templateNoText={_("Search in DMs with {0}")}
                                entity={
                                    <span className="font-medium text-ink-gray-8 shrink-0 whitespace-nowrap">{peerUser.first_name || peerUser.name}</span>
                                }
                            />
                        ) : isDMRoute ? (
                            <ScopedLabel
                                text={text}
                                templateWithText={_("Search for {0} in {1}")}
                                templateNoText={_("Search in {0}")}
                                entity={
                                    <span className="font-medium text-ink-gray-8 shrink-0 whitespace-nowrap">{_("Direct Messages")}</span>
                                }
                            />
                        ) : (
                            <ScopedLabel
                                text={text}
                                templateWithText={_("Search for {0}")}
                                templateNoText={_("Search")}
                            />
                        )}
                    </CommandItem>
                    {/* "Search anywhere": the UNSCOPED counterpart, shown only when the primary
                        item is scoped to the current channel/DM (in global context that item is
                        already unscoped, so this would be redundant). Fixed non-matching value +
                        forceMount, same as above, so it stays visible without stealing the highlight. */}
                    {(channel || peerUser || isDMRoute) && (
                        <CommandItem
                            value="raven-global-search-anywhere"
                            forceMount
                            onSelect={() => {
                                navigate(text ? `/search?q=${encodeURIComponent(text)}` : '/search')
                                setOpen(false)
                            }}
                            className='cursor-pointer min-w-0'
                        >
                            <TextSearch className="shrink-0" />
                            <ScopedLabel
                                text={text}
                                templateWithText={_("Search for {0} anywhere")}
                                templateNoText={_("Search anywhere")}
                            />
                        </CommandItem>
                    )}
                </CommandGroup>
                <CommandEmpty>
                    {_("No results found.")}
                </CommandEmpty>
            </CommandList>
            {!inDrawer && <CommandFooter />}
        </Command>
    )
}

/** frappe-ui's palette kbd chip: smaller and flatter than the base Kbd. */
const FOOTER_KBD = "h-auto min-w-0 rounded-sm p-0.5 text-[11px] text-ink-gray-5 [&_svg:not([class*='size-'])]:size-4"

/** Espresso palette footer: keyboard hints on a hairline-separated bar, per the
 *  frappe-ui docs palette. Desktop dialog only — the mobile drawer has no keyboard. */
const CommandFooter = () => {
    return (
        <div className="flex shrink-0 items-center justify-between border-t border-outline-gray-2 px-2.5 py-2 text-xs text-ink-gray-6 select-none">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                    <KbdGroup aria-hidden className="gap-1">
                        <Kbd className={FOOTER_KBD}><ArrowDownIcon /></Kbd>
                        <Kbd className={FOOTER_KBD}><ArrowUpIcon /></Kbd>
                    </KbdGroup>
                    <span className="ml-1">{_("to navigate")}</span>
                </span>
                <span className="flex items-center gap-1">
                    <Kbd aria-hidden className={FOOTER_KBD}><CornerDownLeftIcon /></Kbd>
                    <span className="ml-1">{_("to select")}</span>
                </span>
                <span className="flex items-center gap-1">
                    <Kbd aria-hidden className={cn(FOOTER_KBD, "px-1 text-sm")}>esc</Kbd>
                    <span className="ml-1">{_("to close")}</span>
                </span>
            </div>
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                    <Kbd aria-hidden className={cn(FOOTER_KBD, "px-1")}><KeyboardMetaKeyIcon /><span className="text-xs">G</span></Kbd>
                    <span className="ml-1">{_("to search")}</span>
                </span>
                <span className="flex items-center gap-1">
                    <Kbd aria-hidden className={cn(FOOTER_KBD, "px-1")}><KeyboardMetaKeyIcon /><span className="text-xs">K</span></Kbd>
                    <span className="ml-1">{_("to open")}</span>
                </span>
            </div>
        </div>
    )
}

interface ScopedLabelProps {
    text: string
    /** Translatable template used when query text is present, e.g. "Search for {0} in DMs with {1}". {0} = query, {1} = entity. */
    templateWithText: string
    /** Translatable template used when query text is empty, e.g. "Search in DMs with {0}". {0} = entity. Pass empty string when there is no entity (global option). */
    templateNoText: string
    /** Entity node (channel, peer, workspace name, etc.). May be null for global search. */
    entity?: React.ReactNode
}

function ScopedLabel({ text, templateWithText, templateNoText, entity }: ScopedLabelProps) {
    const nodes = text
        ? interpolate(templateWithText, [
            <span key="q" className="truncate min-w-0">{`\`${text}\``}</span>,
            entity,
        ])
        : interpolate(templateNoText, [entity])
    return <div className="flex gap-1 items-center min-w-0 flex-1">{nodes}</div>
}

/** Split a `{n}`-style template and interpolate JSX nodes at each placeholder position. */
function interpolate(template: string, nodes: React.ReactNode[]): React.ReactNode[] {
    return template.split(/\{(\d+)\}/g).map((part, i) => {
        if (i % 2 === 1) {
            return <React.Fragment key={i}>{nodes[Number(part)] ?? null}</React.Fragment>
        }
        const trimmed = part.trim()
        return trimmed ? <span key={i} className="shrink-0 whitespace-nowrap">{trimmed}</span> : null
    })
}

export default CommandMenu
