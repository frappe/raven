import { useContext, useEffect, useMemo } from 'react'
import { useSetAtom } from 'jotai'
import { PinOff } from 'lucide-react'
import { FrappeConfig, FrappeContext } from 'frappe-react-sdk'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { usePinnedMessages } from '@hooks/usePinnedMessages'
import { useChannelMembers } from '@hooks/useChannelMembers'
import { useChannel } from '@hooks/useChannel'
import { useIsMobile } from '@hooks/use-mobile'
import { formatRelativeDate } from '@lib/date'
import { Skeleton } from '@components/ui/skeleton'
import { errorResponseToast } from '@components/ui/error-banner'
import { getMessageTeaser } from '@utils/messageUtils'
import { channelDrawerAtom } from '@utils/channelAtoms'
import { messageTargetAtom, makeMessageTarget } from '@utils/channelAtoms'
import { parsePinnedIds } from '@stores/messages/selectors'
import { channelStore } from '@stores/channels/store'
import { subscribeToChannelListUpdated } from '@stores/channels/channelEvents'
import _ from '@lib/translate'
import { TAB_SCROLLER } from './tabPanel'
import { Button } from '@components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip'

const ChannelPins = ({ channelID }: { channelID: string }) => {
    const { pins, isLoading, mutate } = usePinnedMessages(channelID)
    const { members } = useChannelMembers(channelID)
    const { channel } = useChannel(channelID)
    const isMobile = useIsMobile()

    // Refetch when THIS channel changes on the server. We react to the
    // rebroadcast `channel_list_updated` realtime event, which fires
    // after_commit — NOT the store's pinned string, which the pin/unpin
    // optimistic patch changes BEFORE the write commits (refetching then
    // returned the pre-pin list, so the tab lagged one pin behind). This way a
    // pin/unpin from the stream, another device, or someone else refreshes the
    // list against committed state.
    useEffect(() => {
        return subscribeToChannelListUpdated((updatedChannelID) => {
            if (updatedChannelID === channelID) mutate()
        })
    }, [channelID, mutate])

    const membersByName = useMemo(() => new Map(members.map((member) => [member.name, member])), [members])

    // Unpinning is a channel mutation — members only (same rule as the stream's
    // pin action).
    const canUnpin = Boolean(channel?.member_id)

    const setMessageTarget = useSetAtom(messageTargetAtom(channelID))
    const setDrawerType = useSetAtom(channelDrawerAtom(channelID))

    // Clicking a pin jumps the stream to it — the same target atom every other
    // entry point (reply click, deep link, notification) uses.
    const jumpToMessage = (messageID: string) => {
        setMessageTarget(makeMessageTarget(messageID))
        // Mobile: the drawer is a bottom sheet COVERING the stream — dismiss it so
        // the jump is actually visible. The desktop side rail can stay open.
        if (isMobile) setDrawerType('')
    }

    const { call } = useContext(FrappeContext) as FrappeConfig
    const handleUnpin = (messageID: string) => {
        // Optimistic, same pattern as the stream's pin action: patch the channel's
        // pinned set so the pinned bar reacts immediately, revert on failure. This
        // list refreshes off the after-commit channel_list_updated event (above),
        // not from here — so it always reflects committed state.
        const prev = channelStore.getChannel(channelID)?.pinned_messages_string ?? ""
        const ids = parsePinnedIds(prev)
        ids.delete(messageID)
        channelStore.patchChannel(channelID, { pinned_messages_string: [...ids].join("\n") })
        call.post("raven.api.raven_channel.toggle_pin_message", {
            channel_id: channelID,
            message_id: messageID,
        }).catch((error) => {
            channelStore.patchChannel(channelID, { pinned_messages_string: prev })
            errorResponseToast(_("Could not unpin message"), error)
        })
    }

    // No filters to pin, so the whole panel is the scroller (fade + safe-area
    // padding inside the scroll — the drawer wrapper no longer scrolls).
    return (
        <div className={TAB_SCROLLER}>
            {isLoading || !pins ? <PinsSkeleton /> :
                pins.length === 0 ? <div className="text-sm text-ink-gray-4 text-center py-8">{_("No pinned messages in this channel yet.")}</div> :
                    <div className="space-y-2">
                        {pins.map((message) => {
                            const member = membersByName.get(message.owner)
                            return (
                                // div + role="button" (not a real <button>): the card holds
                                // its own Unpin button, and a button inside a button is
                                // invalid HTML. Enter/Space on the card jumps; the target
                                // check keeps a click on Unpin from also jumping.
                                <div
                                    key={message.name}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => jumpToMessage(message.name)}
                                    onKeyDown={(event) => {
                                        if (event.target !== event.currentTarget) return
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            jumpToMessage(message.name)
                                        }
                                    }}
                                    aria-label={_("Jump to pinned message")}
                                    className="group p-3 border border-outline-gray-1 rounded-md hover:bg-surface-gray-1 transition-colors cursor-pointer w-full text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        {member && <>
                                            <UserAvatar
                                                user={member}
                                                size="sm"
                                            />
                                            <div className="font-medium text-sm">{member.full_name}</div>
                                        </>}
                                        <div className="text-xs text-ink-gray-4 flex-1">
                                            {formatRelativeDate(message.creation)}
                                        </div>
                                        {canUnpin && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button isIconButton
                                                        variant="ghost"
                                                        size="xs"
                                                        className='md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity'
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            handleUnpin(message.name)
                                                        }}
                                                    >
                                                        <PinOff />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {_("Unpin")}
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                    {/* Plain-text teaser (content is Tiptap HTML; media pins
                                        get an icon + label) — same helper as the sidebar */}
                                    <div className="text-p-base text-ink-gray-8 line-clamp-4">
                                        {getMessageTeaser(message, undefined, 160)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>}
        </div>
    )
}

/* Loading placeholder shaped like the pin cards, so the skeleton→content swap
   doesn't reflow the tab. Teaser-line widths vary per card to read as real
   content instead of a uniform block. */
const PINS_SKELETON_WIDTHS = ['w-full', 'w-4/5', 'w-3/5']

const PinsSkeleton = () => (
    <div className="px-1 space-y-2" aria-hidden="true">
        {PINS_SKELETON_WIDTHS.map((width, index) => (
            <div key={index} className="rounded-lg border border-outline-gray-1 p-3">
                <div className="mb-1 flex items-center gap-2">
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-12" />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className={`h-3 ${width}`} />
                </div>
            </div>
        ))}
    </div>
)

export default ChannelPins
