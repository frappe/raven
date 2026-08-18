import { useEffect, useRef } from "react"
import { useOutlet } from "react-router-dom"
import { useEscHotkey } from "@hooks/useEscHotkey"
import { useAtom } from "jotai"
import { recomputeUnreadAnchor } from "@stores/messages/loaders"
import ChatStream from "@components/features/message/ChatStream"
import ChatInput from "@components/features/ChatInput/ChatInput"
import ChannelContextDrawer from "@components/features/channel/ChannelContextDrawer"
import { PollDrawer } from "@components/features/message/renderers/PollDrawer"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { Island } from "@components/layout/Island"
import { FileDropZone } from "@components/features/ChatInput/FileDropZone"
import { useComposerGate, ComposerArea } from "@components/features/ChatInput/composerGate"
import { pollDrawerAtom, channelDrawerAtom } from "@utils/channelAtoms"
import { useIsMobile } from "@hooks/use-mobile"
import { useLayerInAnimation } from "@hooks/useLayerInAnimation"
import { useChannelPinnedString } from "@stores/channels/useChannelList"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { CurrentChannelContext } from "@hooks/useCurrentChannelID"

export interface ChatContentViewProps {
    /** Channel or DM channel id (useCurrentChannelID is used by ThreadDrawer/ChatInput etc.) */
    channelID: string
    /** The page header (ChannelHeader / DMChannelHeader) — rendered INSIDE the chat island. */
    header?: React.ReactNode
    /** Center the first fetch on this message — for panes that target a message without a
     *  URL deep link (notifications page). See ChatStreamProps.initialMessageID. */
    initialMessageID?: string | null
}

/**
 * Shared content view for Channel and Direct Message pages, and the island
 * orchestrator: the chat (header + stream + input) is one Island, and the
 * thread / poll / context drawer is a SECOND Island beside it, separated by
 * the gray canvas gutter + gap. Mobile collapses to full-bleed — thread takes
 * over, drawers are bottom sheets.
 */
export function ChatContentView({
    channelID,
    header,
    initialMessageID,
}: ChatContentViewProps) {
    const isMobile = useIsMobile()
    // Pinned ids come from the CHANNEL STORE, not a prop: the pin toggle patches the
    // store optimistically, and reading it here means every host — channel page, DM
    // page, notification/search/saved panes — shows pin badges and live pin updates.
    // (As a prop, only the channel/DM pages passed it; pins looked broken in panes.)
    const pinnedMessagesString = useChannelPinnedString(channelID)
    // Child route content (the thread drawer). Threads are routes; everything else in the rail is atom state.
    const threadDrawer = useOutlet({
        parentChannelID: channelID,
    })
    const [pollDrawerData, setPollDrawerData] = useAtom(pollDrawerAtom(channelID))
    const [channelDrawerType, setChannelDrawer] = useAtom(channelDrawerAtom(channelID))
    const hasContextDrawer = channelDrawerType !== ""
    const hasThread = !!threadDrawer
    // No slide when the thread layer is already open on a BACK arrival — see the hook.
    const layerAnimation = useLayerInAnimation(hasThread)

    // Skeleton while loading, archived/not-member banner (with Join), or the composer.
    const composerGate = useComposerGate(channelID)
    const composerBlocked = composerGate.state !== "composer"

    // Mobile stacked navigation: the channel stays MOUNTED under an open thread layer,
    // so coming back from the thread re-runs no mount logic — and the "New messages"
    // divider (normally cleared on re-entry) would linger over messages read before
    // the thread opened. Recompute it when the thread layer closes. Desktop is
    // untouched: the channel stays visible beside the thread there, and clearing the
    // divider mid-view would be jarring.
    const prevHasThread = useRef(hasThread)
    useEffect(() => {
        if (isMobile && prevHasThread.current && !hasThread) recomputeUnreadAnchor(channelID)
        prevHasThread.current = hasThread
    }, [hasThread, isMobile, channelID])

    // Mobile: drawers are transient bottom sheets, not a persistent rail — leaving the
    // channel dismisses them for good, instead of stashing them to POP BACK OPEN on the
    // next visit. Desktop deliberately keeps the atom: the rail still being open when
    // you come back is part of the desktop feel.
    useEffect(() => {
        if (!isMobile) return
        return () => {
            setChannelDrawer("")
            setPollDrawerData(null)
        }
    }, [channelID, isMobile])

    // One rail slot → the drawers are mutually exclusive, cleared at the OPEN sites (poll vs
    // context clear each other there; opening a thread clears both via the pill's onClick). No
    // effects. Render precedence (below) lets poll/context OVERLAY a thread; closing one brings
    // the thread route back.

    // Escape closes the top overlay (poll, then context). A thread underneath keeps its own
    // Escape (ThreadDrawer), gated so it doesn't fire while an overlay is up.
    // useEscHotkey stands down while any modal (attachment preview, dialogs, ...)
    // is open, so one press never closes both the modal and the drawer.
    useEscHotkey(() => {
        if (pollDrawerData) setPollDrawerData(null)
        else if (hasContextDrawer) setChannelDrawer("")
    }, {
        enableOnContentEditable: true,
        enableOnFormTags: true,
        preventDefault: true
    })

    // Desktop-only side rail; on mobile, poll/context drawers render as bottom sheets instead
    const showSideRail = !isMobile && (hasThread || !!pollDrawerData || hasContextDrawer)
    // A poll/context drawer (fixed column) overlays a thread; a thread alone takes half the area.
    const showsOverlay = !!pollDrawerData || hasContextDrawer
    const drawerWidth = hasThread && !showsOverlay ? "w-1/2" : "w-96 max-w-[45%]"

    return (
        // CurrentChannelContext: everything inside this chat view — headers, drawers
        // (rail + mobile sheets), stream — resolves "the current channel" from here,
        // not the URL. The URL only knows the channel on channel/DM routes; this view
        // also renders in the notification/search/saved panes, where URL-derived ids
        // came back empty and broke the drawers.
        <CurrentChannelContext.Provider value={channelID}>
        {/* Canvas gutter: p-1 reveals the gray content-column behind as the
            frame; gap-1 separates the islands. Full-bleed (p-0) on mobile.
            relative: the mobile thread layer below positions against this row. */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-row gap-1 p-0 md:p-1">
            {/* Chat island: header + stream + input. inert while the mobile thread layer
                covers it, so focus/screen readers can't land in the hidden channel. */}
            <Island className="flex-1" inert={isMobile && hasThread ? true : undefined}>
                <FileDropZone channelID={channelID} disabled={composerBlocked}>
                    {header}
                    <ChatStream
                        channelID={channelID}
                        pinnedMessagesString={pinnedMessagesString}
                        initialMessageID={initialMessageID}
                        // Non-members (and archived channels) can't reply / thread / pin —
                        // same authority as the composer below.
                        canInteract={composerGate.state === "composer"}
                    />
                    <div className="shrink-0">
                        <ComposerArea gate={composerGate}>
                            {/* key by channel: remount per channel so the editor re-autofocuses and
                                draft text doesn't bleed across channels (file/send state already
                                lives in channel-keyed atoms, so a remount is safe). */}
                            <ChatInput key={channelID} channelID={channelID} />
                        </ComposerArea>
                    </div>
                </FileDropZone>
            </Island>

            {/* Drawer island (desktop). Poll/context overlay a thread (last-opened wins); the
                thread reappears when they close. */}
            {showSideRail && (
                <Island className={`shrink-0 ${drawerWidth}`}>
                    {pollDrawerData ? (
                        <PollDrawer
                            messageID={pollDrawerData.messageID}
                            onClose={() => setPollDrawerData(null)}
                        />
                    ) : hasContextDrawer ? (
                        <ChannelContextDrawer />
                    ) : (
                        threadDrawer
                    )}
                </Island>
            )}

            {/* Mobile: the thread is a full-screen LAYER above the channel (stacked
                navigation, same as the sidebars) — the channel stays mounted underneath,
                so going back (chevron or iOS back-swipe) reveals it instantly at the same
                scroll position instead of rebuilding it. Hidden (the outlet is null) when
                no thread is open, so it can't cover the channel. Renders the outlet only
                on mobile — desktop renders it in the side rail above. */}
            {isMobile && (
                <div className={cn("absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden bg-surface-base", layerAnimation, !hasThread && "hidden")}>
                    {threadDrawer}
                </div>
            )}

            {/* Mobile: same drawers, presented as bottom sheets */}
            {isMobile && (
                <>
                    <Drawer open={!!pollDrawerData} onOpenChange={(open) => !open && setPollDrawerData(null)}>
                        <DrawerContent className="h-[85dvh]">
                            <DrawerTitle className="sr-only">{_("Poll")}</DrawerTitle>
                            <DrawerDescription className="sr-only">{_("Poll details and votes")}</DrawerDescription>
                            {pollDrawerData && (
                                <PollDrawer
                                    messageID={pollDrawerData.messageID}
                                    onClose={() => setPollDrawerData(null)}
                                />
                            )}
                        </DrawerContent>
                    </Drawer>
                    <Drawer open={hasContextDrawer && !pollDrawerData} onOpenChange={(open) => !open && setChannelDrawer('')}>
                        {/* pb-0: this sheet hosts LISTS (members, settings tabs). The
                            default safe-area padding would end the scrollport above the
                            drawer's bottom edge, hard-clipping rows mid-air — so the
                            inner scrollers carry the safe-area padding themselves and
                            fade the cut (scroll-fade) instead. */}
                        <DrawerContent className="h-[85dvh] pb-0">
                            <DrawerTitle className="sr-only">{_("Channel details")}</DrawerTitle>
                            <DrawerDescription className="sr-only">{_("Channel information and settings")}</DrawerDescription>
                            <ChannelContextDrawer />
                        </DrawerContent>
                    </Drawer>
                </>
            )}
        </div>
        </CurrentChannelContext.Provider>
    )
}
