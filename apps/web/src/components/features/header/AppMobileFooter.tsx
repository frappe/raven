import { useUnreadNotificationsCount } from '@hooks/useNotifications'
import _ from '@lib/translate'
import { cn } from '@lib/utils'
import useCurrentRavenUser from '@raven/lib/hooks/useCurrentRavenUser'
import { useUnreadThreadsCount } from '@stores/threads/useUnreadThreads'
import { useWorkspaces } from '@hooks/useWorkspaces'
import { useDMUnread, useHasUnreadChannels } from '@stores/unread/useChannelUnread'
import { BellIcon, HomeIcon, MessageSquareTextIcon, SearchIcon, UsersRoundIcon } from 'lucide-react'
import { CircleUserRoundIcon } from "lucide-react"
import { NavLink, useMatch } from 'react-router'
import { useRef, useState } from 'react'
import { HomeWorkspacesDrawer, workspacesDrawerAtom } from './HomeWorkspacesDrawer'
import { StatusDrawer } from '@components/features/profile/StatusDrawer'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { hapticTick } from '@utils/haptics'
import { useAtom } from 'jotai'

const FOOTER_LINKS = [
    {
        icon: HomeIcon,
        title: _("Home"),
        to: "/",
    },
    {
        icon: UsersRoundIcon,
        title: _("DMs"),
        to: "/dm-channel",
    },
    {
        icon: MessageSquareTextIcon,
        title: _("Threads"),
        to: "/threads",
    },
    {
        icon: BellIcon,
        title: _("Notifications"),
        to: "/notifications",
    },
    {
        icon: CircleUserRoundIcon,
        title: _("Profile"),
        to: "/profile",
    }
]

/**
 * `inert`: set while a detail layer covers the footer (stacked navigation). The footer
 * must stay MOUNTED then — unmounting it changes the list row's height, which clamps the
 * list's scroll position when it was at the bottom (the "list moved after back" bug) —
 * so hosts cover it with a z-20 layer and inert it instead of removing it.
 */
const AppMobileFooter = ({ inert }: { inert?: boolean }) => {
    return (
        <AppMobileFooterContainer inert={inert}>
            <HomeLink />
            <DirectMessageLink />
            <ThreadsLink />
            <NotificationsLink />
            <ProfileLink />
        </AppMobileFooterContainer>
    )
}


export default AppMobileFooter

/** Renders a skeleton where the buttons are not clickable */
export const AppMobileFooterSkeleton = () => {
    return <AppMobileFooterContainer>
        {FOOTER_LINKS.map((link) => (
            <FooterNavLinkSkeleton key={link.to} icon={<link.icon />} title={link.title} />
        ))}
    </AppMobileFooterContainer>
}

// In-flow (NOT position: fixed): the bar takes its real height in the host's flex
// column, so the content above always ends exactly at the bar. The old fixed bar
// needed an h-16 spacer to reserve space, and any mismatch (standalone:pb-4, content
// a few px over 64) made the bar overhang the bottom of every list.
const AppMobileFooterContainer = ({ children, className, inert }: { children: React.ReactNode, className?: string, inert?: boolean }) => {

    return <div className={cn("md:hidden grid grid-cols-5 shrink-0 bg-surface-elevation-2 border-t border-outline-gray-2 standalone:pb-[max(env(safe-area-inset-bottom),0.75rem)]", className)} inert={inert}>
        {children}
    </div>
}

const AppMobileFooterButton = ({ icon, title, isActive, badgeCount, showDot }: { icon: React.ReactNode, title: string, isActive: boolean, badgeCount?: number, showDot?: boolean }) => {

    return <div data-active={isActive} title={title} className={cn(
        "flex min-h-14 flex-col items-center justify-center py-3 gap-2 overflow-hidden text-ink-gray-5 active:scale-95 data-active:text-ink-gray-8 [&>svg]:size-6 [&>svg]:text-ink-gray-5 data-active:[&>svg]:text-ink-gray-8"
    )}>
        <div className='relative'>
            {icon}
            <UnreadBadge count={badgeCount} />
            {/* Activity dot (no number) — Home uses it for channel unreads:
                    channels are ambient, not an inbox, so "there's activity" is
                    the honest signal; counts stay on the personal queues. */}
            {showDot && !badgeCount && (
                <span className="absolute -top-1 -right-2 size-2 rounded-full bg-surface-red-6" aria-hidden="true" />
            )}
        </div>
        <span className='text-xs-medium text-center'>{title}</span>
    </div>
}

const UnreadBadge = ({ count }: { count?: number }) => {

    if (!count || count === 0) return null

    // Pill, not a fixed circle: a single digit stays circular (min-w == height),
    // but "9+" / two digits grow horizontally with px-1 so the glyphs aren't
    // crushed against the boundary. h-4 keeps the cap height stable either way.
    return <span className="absolute -top-1.5 -right-3 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-surface-red-6 dark:bg-surface-red-6 text-ink-base dark:text-ink-red-1 text-[10px] leading-none">
        {count > 9 ? "9+" : count}
    </span>

}

const DirectMessageLink = () => {
    const unread = useDMUnread()

    return <FooterNavLink
        icon={<UsersRoundIcon />}
        title={_("DMs")}
        to={"/dm-channel"}
        badgeCount={unread}
    />
}

const NotificationsLink = () => {
    // Store-derived (unread-id set size); kept live globally by useNotificationsRealtime.
    const unreadCount = useUnreadNotificationsCount()

    return <FooterNavLink
        icon={<BellIcon />}
        title={_("Notifications")}
        to={"/notifications"}
        badgeCount={unreadCount}
    />
}

const ThreadsLink = () => {
    const unread = useUnreadThreadsCount()

    return <FooterNavLink
        icon={<MessageSquareTextIcon />}
        title={_("Threads")}
        to={"/threads"}
        badgeCount={unread}
    />
}
const FooterNavLink = ({ to, icon, title, badgeCount }: { to: string; icon: React.ReactNode; title: string, badgeCount?: number }) => {
    return (
        <NavLink to={to} end>
            {({ isActive }) => (
                <AppMobileFooterButton icon={icon} title={title} isActive={isActive} badgeCount={badgeCount} />
            )}
        </NavLink>
    )
}

const FooterNavLinkSkeleton = ({ title, icon }: { title: string, icon: React.ReactNode }) => {
    return <AppMobileFooterButton icon={icon} title={title} isActive={false} />
}

/** Hold a footer tab this long (touch) to trigger its long-press action. */
const LONG_PRESS_MS = 450
/** Finger drift beyond this cancels the long-press — it's a scroll, not a hold. */
const LONG_PRESS_SLOP_PX = 10
/** Suppress the synthetic click (and its navigation) after the long-press fires. */
const LONG_PRESS_CLICK_GUARD_MS = 500

/**
 * Touch long-press detector for footer tabs (Home → catch-up drawer, Profile →
 * status picker): timer + drift slop, then a click guard so finger-lift doesn't
 * ALSO navigate. iOS never fires contextmenu, so a timer is the only reliable
 * trigger; the touch-callout suppression in the returned props stops iOS's link
 * preview (and Android's link context menu) from competing.
 *
 * Spread the returned props onto the tab's NavLink.
 */
const useFooterLongPress = (onLongPress: () => void) => {
    const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null)
    const suppressClickUntilRef = useRef(0)

    const cancelPress = () => {
        if (!pressRef.current) return
        window.clearTimeout(pressRef.current.timer)
        pressRef.current = null
    }

    const onPointerDown = (event: React.PointerEvent) => {
        if (event.pointerType !== "touch") return
        cancelPress()
        const timer = window.setTimeout(() => {
            pressRef.current = null
            suppressClickUntilRef.current = performance.now() + LONG_PRESS_CLICK_GUARD_MS
            hapticTick()
            onLongPress()
        }, LONG_PRESS_MS)
        pressRef.current = { timer, x: event.clientX, y: event.clientY }
    }

    const onPointerMove = (event: React.PointerEvent) => {
        const press = pressRef.current
        if (!press) return
        if (Math.abs(event.clientX - press.x) > LONG_PRESS_SLOP_PX || Math.abs(event.clientY - press.y) > LONG_PRESS_SLOP_PX) {
            cancelPress()
        }
    }

    const onClick = (event: React.MouseEvent) => {
        if (performance.now() < suppressClickUntilRef.current) {
            suppressClickUntilRef.current = 0
            event.preventDefault()
            event.stopPropagation()
        }
    }

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp: cancelPress,
        onPointerCancel: cancelPress,
        onClick,
        onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
        className: "select-none [-webkit-touch-callout:none]",
        draggable: false,
    }
}

const HomeLink = () => {
    // Home is active on a workspace route (`/:workspaceID` or a channel/thread under it) and on
    // the index. The catch: `/:workspaceID` is a single dynamic segment, so it also matches the
    // sibling top-level routes (/threads, /dm-channel, /notifications, /profile, /search, …) —
    // which is why Home looked "always active". Disambiguate by checking the first segment
    // against the REAL workspaces, not just "any string".
    const { workspaces } = useWorkspaces()
    const wsMatch = useMatch("/:workspaceID/*")
    const isIndex = Boolean(useMatch({ path: "/", end: true }))
    const ws = wsMatch?.params.workspaceID
    const isWorkspaceRoute = !!ws && workspaces.some((w) => w.name === ws)

    // Channel unreads get a DOT, not a count — channels are ambient (curated
    // sidebar, not an inbox); the numeric badges stay on the personal queues.
    const hasUnreadChannels = useHasUnreadChannels()

    // Long-press → catch-up drawer (unread channels across workspaces + switcher).
    // Shared with the sidebar's workspace switcher (its mobile tap opens this too).
    const [drawerOpen, setDrawerOpen] = useAtom(workspacesDrawerAtom)
    const pressProps = useFooterLongPress(() => setDrawerOpen(true))

    // RE-TAP on the Home ROOT (the channel list — `/` or a bare workspace, no
    // channel open) opens the same drawer: the tab is already showing its page,
    // so the tap would otherwise be dead, and it makes the switcher reachable
    // without knowing the long-press. Only when there is something to switch
    // TO (2+ member workspaces) — with one, the re-tap stays inert. Deeper
    // pages (a channel, another tab) keep the tap as plain "go home".
    const atHomeRoot = isIndex || (isWorkspaceRoute && !wsMatch?.params["*"])
    const hasMultipleWorkspaces = workspaces.filter((w) => w.workspace_member_name).length > 1

    const onClick = (event: React.MouseEvent) => {
        // Long-press click guard first — a finger-lift after the drawer already
        // opened must not also count as a tap.
        pressProps.onClick(event)
        if (event.defaultPrevented) return
        if (atHomeRoot && hasMultipleWorkspaces) {
            event.preventDefault() // stay put — the drawer is the action
            setDrawerOpen(true)
        }
    }

    return (
        <>
            <NavLink to="/" {...pressProps} onClick={onClick}>
                {() => (
                    <AppMobileFooterButton
                        icon={<HomeIcon />}
                        title={_("Home")}
                        isActive={isIndex || isWorkspaceRoute}
                        showDot={hasUnreadChannels}
                    />
                )}
            </NavLink>
            <HomeWorkspacesDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
        </>
    )
}

const ProfileLink = () => {

    const { myProfile } = useCurrentRavenUser()

    // Long-press → quick availability picker; a plain tap still navigates to
    // the profile page, where the full editor lives.
    const [statusOpen, setStatusOpen] = useState(false)
    const pressProps = useFooterLongPress(() => setStatusOpen(true))

    return (
        <>
            <NavLink to="/profile" end {...pressProps}>
                {({ isActive }) => (
                    <AppMobileFooterButton
                        // UserAvatar (not a raw img): its status indicator mirrors the
                        // availability this tab's long-press sets — with all the usual
                        // rules (Invisible shows nothing, on-leave badge wins) for free.
                        // `block`: every other footer icon is block-level (Tailwind's
                        // preflight blockifies img/svg), but UserAvatar's wrapper is
                        // inline-block — baseline-aligned, so it adds descender space
                        // under the icon and pushes the label down.
                        icon={myProfile
                            ? <UserAvatar user={myProfile} size="sm" className="block" showStatusIndicator showBotIndicator={false} />
                            : <CircleUserRoundIcon />}
                        title={_("Profile")}
                        isActive={isActive}
                    />
                )}
            </NavLink>
            <StatusDrawer open={statusOpen} onOpenChange={setStatusOpen} />
        </>
    )
}