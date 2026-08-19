import { useState } from 'react'
import { Search, SearchIcon } from 'lucide-react'
import { useSetAtom } from 'jotai'
import { LinkResultContent } from '@components/common/LinkResultBlock/LinkResultContent'
import { ProviderFilter } from '@components/common/filters/ProviderFilter'
import { channelDrawerAtom, makeMessageTarget, messageTargetAtom } from '@utils/channelAtoms'
import { useIsMobile } from '@hooks/use-mobile'
import { useDebounceValue } from 'usehooks-ts'
import { useFrappeEventListener } from 'frappe-react-sdk'
import _ from '@lib/translate'
import { Skeleton } from '@components/ui/skeleton'
import { ChannelMemberData, useChannelMembers } from '@hooks/useChannelMembers'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { formatRelativeDate } from '@lib/date'
import ErrorBanner from '@components/ui/error-banner'
import { LinkSearchResult, useLinkSearch } from '@hooks/useLinkSearch'
import { Input } from '@components/ui/input'
import { TAB_SCROLLER } from './tabPanel'
import { InputGroup, InputGroupAddon } from '@components/ui/input-group'

const ChannelLinks = ({ channelID }: { channelID: string }) => {
    const { members } = useChannelMembers(channelID)
    // Debounced at the INPUT (uncontrolled below): keystrokes render nothing;
    // the tab re-renders once per settled query. The search hooks no longer
    // debounce internally — this is the one debounce.
    const [searchQuery, setSearchQuery] = useDebounceValue('', 200)
    // Same picker as the search page's links tab. Local state — the
    // drawer has no URL to keep it in.
    const [providers, setProviders] = useState<string[]>([])
    const isMobile = useIsMobile()

    const setMessageTarget = useSetAtom(messageTargetAtom(channelID))
    const setDrawerType = useSetAtom(channelDrawerAtom(channelID))

    // Clicking a link card jumps the stream to its message — the same
    // target atom every other entry point uses (pins, replies, deep
    // links). Every result is in THIS channel: the search is filtered by
    // channel_id, which matches direct channel messages only.
    const jumpToMessage = (messageID: string) => {
        setMessageTarget(makeMessageTarget(messageID))
        // Mobile: the drawer is a bottom sheet COVERING the stream —
        // dismiss it so the jump is actually visible. The desktop side
        // rail can stay open.
        if (isMobile) setDrawerType('')
    }

    const { results, isLoading, error, mutate } = useLinkSearch(searchQuery, {
        channel_id: channelID,
        link_provider: providers,
    }, 100)

    useFrappeEventListener("link_previews_updated", (data: { channel_id: string }) => {
        if (data.channel_id === channelID) {
            mutate()
        }
    })

    return (
        // Flex column: the filter row stays pinned; only the list below scrolls.
        <div className="flex flex-1 min-h-0 flex-col gap-3">
            {/* Search bar + source picker */}
            <div className="flex shrink-0 items-center gap-2">
                <InputGroup>
                    <InputGroupAddon>
                        <SearchIcon />
                    </InputGroupAddon>
                    <Input
                        inputSize="sm"
                        placeholder={_("Search...")}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </InputGroup>
                {/* Icon trigger: a labeled trigger's width changes with the
                    selection and would squeeze the search box beside it. */}
                <ProviderFilter
                    value={providers}
                    onValueChange={setProviders}
                    iconTrigger
                    // size-8 matches the search field beside it.
                    triggerClassName="size-8"
                    className="shrink-0"
                />
            </div>
            {error && <ErrorBanner error={error} />}
            {/* Links List — the tab's one scroller (fade + safe-area padding). */}
            <div className={TAB_SCROLLER}>
                {isLoading ? <LinkPreviewSkeletonList /> :
                    results.length === 0 ? <div className="text-sm text-ink-gray-4 text-center py-8">{searchQuery || providers.length > 0 ? _("No links found matching your search.") : _("No links shared in this channel yet.")}</div> :
                        <div className='space-y-2'>
                            {results.map((link) => {
                                const member = members.find((m) => m.name === link.author)
                                return (
                                    <LinkPreviewCard
                                        key={`${link.id}-${link.url}`}
                                        link={link}
                                        member={member}
                                        onClick={() => jumpToMessage(link.id)}
                                    />
                                )
                            })}
                        </div>}
            </div>
        </div>
    )
}

const LinkPreviewSkeleton = ({ i = 0 }: { i?: number }) => {
    // Mirrors the real card: shared-by line, then the compact link block
    // (small thumb beside text).
    return (
        <div className="w-full rounded-lg border border-outline-gray-2 p-3 space-y-2">
            <div className="flex items-center gap-1.5">
                <Skeleton className="size-4 rounded-full shrink-0" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
            </div>
            <div className="flex gap-3">
                <Skeleton className="h-14 w-24 rounded-md shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                    <Skeleton className="h-4" style={{ width: `${45 + (i % 4) * 15}%` }} />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
        </div>
    )
}

const LinkPreviewSkeletonList = () => {
    return (
        <div className="flex w-full flex-1 flex-col lg:mx-auto space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <LinkPreviewSkeleton key={i} i={i} />
            ))}
        </div>
    )
}

const LinkPreviewCard = ({ link, member, onClick }: {
    link: LinkSearchResult,
    member?: ChannelMemberData,
    /** Jumps the stream to the link's message. */
    onClick: () => void,
}) => {
    return (
        <div
            className="group border border-outline-gray-2 rounded-lg hover:bg-surface-gray-1 transition-colors cursor-pointer overflow-hidden w-full p-3"
            tabIndex={0}
            role="button"
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
            aria-label={_('Jump to message with link: {0}', [link.title || link.url])}>

            <div className="space-y-2">
                {/* Who shared it and when — the link block below is the same
                    one the search Links tab renders. */}
                <div className="flex items-center gap-1.5 text-xs text-ink-gray-4">
                    {member && <>
                        <UserAvatar
                            user={member}
                            size="xs"
                            showStatusIndicator={false}
                        />
                        <span className="truncate text-ink-gray-6">{member.full_name}</span>
                        <span>·</span>
                    </>}
                    <span className="shrink-0">{formatRelativeDate(link.creation)}</span>
                </div>
                {/* compact: the drawer is too narrow for banners and wide thumbs. */}
                <LinkResultContent link={link} compact />
            </div>
        </div>
    )
}

export default ChannelLinks
