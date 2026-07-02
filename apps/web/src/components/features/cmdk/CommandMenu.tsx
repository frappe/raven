import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog'
import { Drawer, DrawerContent } from '@components/ui/drawer'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@components/ui/command'
import _ from '@lib/translate'
import { defaultFilter } from 'cmdk'
import React, { useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import { TextSearch } from 'lucide-react'
import { useAtom, useSetAtom } from 'jotai'
import ChannelList from './ChannelList'
import UserList from './UserList'
import SettingsList from './SettingsList'
import QuickActions from './CommandList'
import { commandMenuOpenAtom } from './atoms'
import { useCurrentChannelID } from '@hooks/useCurrentChannelID'
import { useChannel } from '@hooks/useChannel'
import { useUser } from '@hooks/useUser'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { useIsMobile } from '@hooks/use-mobile'
import { useLocation, useParams } from 'react-router-dom'

const CommandMenu = () => {
    const [open, setOpen] = useAtom(commandMenuOpenAtom)
    const isMobile = useIsMobile()

    useHotkeys('mod+k', () => setOpen((open) => !open), {
        preventDefault: true,
        enableOnFormTags: true,
        enableOnContentEditable: true,
    })

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent className="h-[90vh] flex flex-col">
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
                className="rounded w-150 max-w-none sm:max-w-none p-1 gap-0 overflow-hidden [&>button:last-child]:hidden"
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
    const { workspaceID, id: channelIDFromURL } = useParams()
    const location = useLocation()
    const channelID = useCurrentChannelID()
    const { channel, dmChannel } = useChannel(channelIDFromURL ? channelID : "")
    const peerUser = useUser(dmChannel?.peer_user_id || "")
    const isDMRoute = location.pathname.startsWith('/dm-channel') && !channelIDFromURL

    const isMobile = useIsMobile()

    // Items set `value` to a UNIQUE id (a channel's "workspaceID-channelName", a user's id, a
    // "settings-…" slug) and put the human-searchable text in `keywords`. cmdk's default filter
    // scores value + keywords together, so the id leaks into matching — e.g. in a "Frappe"
    // workspace every channel id starts with "Frappe-", so searching "frappe" matched them all.
    // Score against keywords ONLY when present (the name/label), falling back to value for items
    // that have none (so the global "Search…" item and anything keyword-less still match).
    const customFilter = (value: string, search: string, keywords?: string[]) =>
        keywords?.length ? defaultFilter(keywords.join(' '), search) : defaultFilter(value, search)

    return (
        <Command
            label="Global Command Menu"
            filter={customFilter}
            className={inDrawer ? "flex flex-col flex-1 min-h-0 bg-transparent" : ""}
        >
            <CommandInput
                autoFocus={!isMobile}
                value={text}
                onValueChange={(v) => setText(v.slice(0, 140))}
                maxLength={140}
                placeholder={_("Search or type a command")}
            />
            <CommandList className={inDrawer ? "flex-1 overflow-auto max-h-none" : "max-h-105"}>

                <ChannelList text={text} />
                <UserList text={text} />
                <SettingsList text={text} />
                <QuickActions text={text} />
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
                        onSelect={() => {
                            const params = new URLSearchParams()
                            if (text) params.set('q', text)
                            if (channelIDFromURL) params.set('channel', channelID)
                            else if (isDMRoute) params.set('is_dm', '1')
                            const qs = params.toString()
                            navigate(qs ? `/search?${qs}` : '/search')
                            setOpen(false)
                        }}
                        className='cursor-pointer min-w-0'
                    >
                        <TextSearch className="h-4 w-4 text-ink-gray-4 shrink-0" />
                        {channel ? (
                            <ScopedLabel
                                text={text}
                                templateWithText={_("Search for {0} in {1}")}
                                templateNoText={_("Search in {0}")}
                                entity={
                                    <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1">
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
                </CommandGroup>
                <CommandEmpty>
                    {_("No results found.")}
                </CommandEmpty>
            </CommandList>
        </Command>
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
