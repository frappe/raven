import { useContext, useMemo } from 'react'
import { useSetAtom } from 'jotai'
import { PinOff } from 'lucide-react'
import { FrappeConfig, FrappeContext } from 'frappe-react-sdk'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { usePinnedMessages } from '@hooks/usePinnedMessages'
import { useChannelMembers } from '@hooks/useChannelMembers'
import { useChannel } from '@hooks/useChannel'
import { useIsMobile } from '@hooks/use-mobile'
import { formatRelativeDate } from '@lib/date'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'
import { errorResponseToast } from '@components/ui/error-banner'
import { getMessageTeaser } from '@utils/messageUtils'
import { channelDrawerAtom } from '@utils/channelAtoms'
import { messageTargetAtom, makeMessageTarget } from '@utils/channelAtoms'
import { parsePinnedIds } from '@stores/messages/selectors'
import { channelStore } from '@stores/channels/store'
import _ from '@lib/translate'

const ChannelPins = ({ channelID }: { channelID: string }) => {
    const { pins, isLoading, mutate } = usePinnedMessages(channelID)
    const { members } = useChannelMembers(channelID)
    const { channel } = useChannel(channelID)
    const isMobile = useIsMobile()

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
        // pinned set (the pinned bar reacts immediately), revert on failure, and
        // refresh this tab's list on success.
        const prev = channelStore.getChannel(channelID)?.pinned_messages_string ?? ""
        const ids = parsePinnedIds(prev)
        ids.delete(messageID)
        channelStore.patchChannel(channelID, { pinned_messages_string: [...ids].join("\n") })
        call.post("raven.api.raven_channel.toggle_pin_message", {
            channel_id: channelID,
            message_id: messageID,
        }).then(() => mutate())
            .catch((error) => {
                channelStore.patchChannel(channelID, { pinned_messages_string: prev })
                errorResponseToast(_("Could not unpin message"), error)
            })
    }

    // No scroller of its own — the drawer's shared tab-panel container scrolls.
    return (
        <div>
            {isLoading || !pins ? <MessageListSkeleton /> :
                pins.length === 0 ? <div className="text-sm text-ink-gray-4 text-center py-8">{_("No pinned messages in this channel yet.")}</div> :
                    <div className="px-1 space-y-2">
                        {pins.map((message) => {
                            const member = membersByName.get(message.owner)
                            return (
                                <button
                                    key={message.name}
                                    type="button"
                                    onClick={() => jumpToMessage(message.name)}
                                    aria-label={_("Jump to pinned message")}
                                    className="group p-3 border border-outline-gray-2/70 rounded-lg hover:bg-surface-gray-2/50 transition-colors cursor-pointer w-full text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        {member && <>
                                            <UserAvatar
                                                user={member}
                                                size="sm"
                                            />
                                            <div className="font-medium text-sm">{member.full_name}</div>
                                        </>}
                                        <div className="text-xs text-ink-gray-4/80 flex-1">
                                            {formatRelativeDate(message.creation)}
                                        </div>
                                        {canUnpin && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                title={_("Unpin")}
                                                aria-label={_("Unpin message")}
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    handleUnpin(message.name)
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault()
                                                        event.stopPropagation()
                                                        handleUnpin(message.name)
                                                    }
                                                }}
                                                className="shrink-0 rounded p-1 text-ink-gray-4 hover:text-ink-gray-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity"
                                            >
                                                <PinOff className="size-3.5" />
                                            </span>
                                        )}
                                    </div>
                                    {/* Plain-text teaser (content is Tiptap HTML; media pins
                                        get an icon + label) — same helper as the sidebar */}
                                    <div className="text-sm text-ink-gray-7 line-clamp-2">
                                        {getMessageTeaser(message, undefined, 160)}
                                    </div>
                                </button>
                            )
                        })}
                    </div>}
        </div>
    )
}

export default ChannelPins
