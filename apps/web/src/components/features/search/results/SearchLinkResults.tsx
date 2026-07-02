import { memo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useFrappeEventListener } from 'frappe-react-sdk'
import { ExternalLink, FileBox, MessageSquareMore } from 'lucide-react'
import _ from '@lib/translate'
import { formatRelativeDate } from '@lib/date'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { Skeleton } from '@components/ui/skeleton'
import ErrorBanner from '@components/ui/error-banner'
import { LinkSearchResult, useLinkSearch } from '@hooks/useLinkSearch'
import { UserData } from '@db'
import { WorkspaceFields } from '@hooks/useWorkspaces'
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'
import { useMessageRowLookups } from '@hooks/useMessageRowLookups'
import type { SelectedNotification } from '@pages/notifications/NotificationChat'
import { RESULT_ROW_ACTIVE_CLASS } from '@components/common/MessageResultBlock/MessageResultBlock'
import { cn } from '@lib/utils'
import { SearchFilters } from '../types'

interface SearchLinkResultsProps {
    searchValue?: string
    filters: SearchFilters
    /** Opens the link's message in the right-pane split view. */
    onSelect: (selection: SelectedNotification) => void
    /** Open row id — highlights the active result. */
    selectedID?: string
}

const SearchLinkResults = ({ searchValue, filters, onSelect, selectedID }: SearchLinkResultsProps) => {
    const { results, isLoading, error, mutate } = useLinkSearch(searchValue, filters, 100)
    const { usersById, channelById, dmById, workspaceById } = useMessageRowLookups()

    useFrappeEventListener('link_previews_updated', () => mutate())

    if (error) return <ErrorBanner error={error} />
    if (isLoading) return <LinkPreviewSkeletonList />
    if (results.length === 0) {
        return (
            <div className="text-sm text-ink-gray-4 text-center py-8">
                {_('No links found.')}
            </div>
        )
    }

    return (
        <Virtuoso
            data={results}
            style={{ height: '100%' }}
            initialItemCount={Math.min(results.length, 10)}
            computeItemKey={(_idx, link) => `${link.id}::${link.url}`}
            itemContent={(_idx, link) => {
                // Thread replies live in a thread channel; resolve display against the
                // real (parent) channel so selection carries the routing-ready id.
                const baseChannelId = link.parent_channel_id ?? link.channel_id
                const channel = channelById.get(baseChannelId)
                const dmChannel = dmById.get(baseChannelId)
                const peer = dmChannel ? usersById.get(dmChannel.peer_user_id) : undefined
                return (
                    <LinkResultRow
                        link={link}
                        user={usersById.get(link.author)}
                        channel={channel}
                        dmChannel={dmChannel}
                        peer={peer}
                        workspace={channel?.workspace ? workspaceById.get(channel.workspace) : undefined}
                        className={selectedID === link.id ? RESULT_ROW_ACTIVE_CLASS : undefined}
                        onClick={() => onSelect({
                            channelID: baseChannelId,
                            messageID: link.id,
                            isDirectMessage: !!dmChannel,
                            peer,
                            isThread: !!link.is_thread,
                        })}
                    />
                )
            }}
        />
    )
}

interface LinkResultRowProps {
    link: LinkSearchResult
    user?: UserData
    channel?: ChannelListItem
    dmChannel?: DMChannelListItem
    peer?: UserData
    workspace?: WorkspaceFields
    onClick: () => void
    className?: string
}

const LinkResultRowInner = ({ link, user, channel, dmChannel, peer, workspace, onClick, className }: LinkResultRowProps) => {
    const url = link.url
    const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()
    const faviconUrl = `https://icons.duckduckgo.com/ip2/${hostname}.ico`
    const peerName = peer?.full_name ?? dmChannel?.peer_user_id ?? ''
    const relativeDate = formatRelativeDate(link.creation)

    return (
        <div className="px-2 py-0.5">
            <div
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
                className={cn(
                    "group flex gap-3 px-2 py-3 md:py-2 rounded transition-colors text-left select-none cursor-pointer hover:bg-surface-gray-3 active:bg-surface-gray-3 focus-visible:bg-surface-gray-3 focus-visible:outline-none",
                    className
                )}
            >
                {user && <UserAvatar user={user} size="md" showStatusIndicator={false} />}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap text-base md:text-sm">
                        {user && <span className="font-medium text-ink-gray-8 truncate">{user.full_name}</span>}
                        <span className="shrink-0 text-xs text-ink-gray-4">{relativeDate}</span>
                        {workspace && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <span className="text-ink-gray-4 truncate min-w-0">{workspace.workspace_name}</span>
                            </>
                        )}
                        {channel && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <ChannelIcon type={channel.type} className="h-3 w-3 shrink-0 self-center text-ink-gray-4" />
                                <span className="text-ink-gray-4 truncate min-w-0 -ml-0.5">{channel.channel_name}</span>
                            </>
                        )}
                        {dmChannel && (
                            <>
                                <span className="text-ink-gray-4 shrink-0">·</span>
                                <MessageSquareMore className="h-3 w-3 shrink-0 self-center text-ink-gray-4" />
                                <span className="text-ink-gray-4 truncate min-w-0 -ml-0.5">{peerName}</span>
                            </>
                        )}
                    </div>

                    <div className="flex gap-3 mt-2">
                        {/* Cascade preview → favicon → FileBox. Both <img> share the same onError swap chain:
                        - primary image fails → swap to favicon
                        - favicon fails → hide img, the always-rendered FileBox sits behind and shows through. */}
                        <div className="relative w-20 h-20 rounded-md bg-surface-gray-2 shrink-0 border border-outline-gray-2 overflow-hidden flex items-center justify-center">
                            <FileBox className="w-8 h-8 text-ink-gray-4" />
                            <img
                                src={link.image || faviconUrl}
                                alt=""
                                data-fallback={link.image ? faviconUrl : ''}
                                className={link.image
                                    ? 'absolute inset-0 w-full h-full object-cover'
                                    : 'absolute inset-0 m-auto w-10 h-10'}
                                onError={(e) => {
                                    const img = e.currentTarget
                                    const fb = img.dataset.fallback
                                    if (fb) {
                                        img.dataset.fallback = ''
                                        img.src = fb
                                        img.className = 'absolute inset-0 m-auto w-10 h-10'
                                    } else {
                                        img.style.display = 'none'
                                    }
                                }}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-base md:text-sm font-medium text-ink-gray-8 truncate">{link.title || url}</h3>
                                <ExternalLink
                                    className="h-3 w-3 text-ink-gray-4 opacity-0 group-hover:opacity-100 hover:text-ink-gray-8 transition-opacity shrink-0"
                                    onClick={(e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener,noreferrer') }}
                                />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-ink-gray-4 mt-0.5">
                                <img src={faviconUrl} alt="" className="w-3 h-3" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                                <span className="truncate">{link.site_name || hostname}</span>
                            </div>
                            {link.description && (
                                <p className="text-xs text-ink-gray-4 mt-1 line-clamp-2">{link.description}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const LinkResultRow = memo(LinkResultRowInner)

const LinkPreviewSkeletonList = () => (
    <div className="flex w-full flex-col space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-4">
                <Skeleton className="h-20 w-20 rounded-md shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                    <Skeleton className="h-4" style={{ width: `${45 + (i % 4) * 15}%` }} />
                    <Skeleton className="h-3" style={{ width: '70%' }} />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
        ))}
    </div>
)

export default SearchLinkResults
