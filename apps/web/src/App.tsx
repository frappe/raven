import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate } from "react-router-dom"
import Channel from "@pages/workspace/Channel"
import Notifications from "@pages/notifications/Notifications"
import NotificationChatRoute from "@pages/notifications/NotificationChatRoute"
import { MessagePermalinkSkeleton } from "@pages/message/MessagePermalinkSkeleton"
import ErrorPage from "@pages/ErrorPage"
import Threads from "@pages/threads/Threads"
import DirectMessages, { DirectMessagesIndex } from "@pages/dm-channel/DirectMessages"
import DirectMessage from "@pages/dm-channel/DirectMessage"
import ThreadDrawerRoute from "@components/features/message/ThreadDrawerRoute"
import { WorkspaceRedirect } from "@components/workspace-switcher/WorkspaceRedirect"
import { FrappeProvider } from 'frappe-react-sdk'
import { initEmojiMart } from '@lib/emojiMart'
import Cookies from 'js-cookie'
import { SearchLayout } from "@components/layout/SearchLayout"
import { Toaster } from "@components/ui/sonner"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { LucideProvider } from "lucide-react"
import { lazy, Suspense, useEffect } from "react"
import AppShell from "@components/layout/AppShell"
import { useAtomValue } from "jotai"
import { lastChannelAtom, lastWorkspaceAtom } from "@utils/lastVisitedAtoms"
import { useIsMobile } from "@hooks/use-mobile"
import { useWorkspaces } from "@hooks/useWorkspaces"
import WorkspaceLayout from "@pages/workspace/WorkspaceLayout"

// Code-split the rarely-visited pages out of the main bundle. React.lazy +
// Suspense (not the data router's route.lazy) on purpose: route.lazy blocks
// rendering the route until its module resolves — a blank screen on the COLD
// entries these pages mostly get (shared links, the OS share sheet) — while
// Suspense paints the app shell + fallback immediately.
// TODO: review the Suspense fallbacks/skeletons for these routes as a set —
// most are `null` today; each page should get a silhouette of its own layout
// (like MessagePermalinkSkeleton) so chunk-load never flashes blank.
const MessagePermalink = lazy(() => import("@pages/message/MessagePermalink"))
const ShareTarget = lazy(() => import("@pages/share/ShareTarget"))
const SavedMessages = lazy(() => import("@pages/saved-messages/SavedMessages"))
const MobileProfile = lazy(() => import("@pages/profile/Profile"))
const Search = lazy(() => import("@pages/search/Search"))

/**
 * Home ("/") redirect, evaluated at RENDER time — module-scope reads froze
 * the last-visited values (and viewport width) at boot, so navigating home
 * mid-session used stale targets.
 */
const IndexRedirect = () => {
  const lastWorkspace = useAtomValue(lastWorkspaceAtom)
  const lastChannel = useAtomValue(lastChannelAtom)
  const isMobile = useIsMobile()
  const { workspaces, isLoading } = useWorkspaces()

  if (lastWorkspace) {
    // Desktop reopens the exact channel; mobile lands on the workspace's
    // channel list (the channel pair is written together, so it's consistent)
    if (lastChannel && !isMobile) {
      return <Navigate to={`/${encodeURIComponent(lastWorkspace)}/${encodeURIComponent(lastChannel)}`} replace />
    }
    return <Navigate to={`/${encodeURIComponent(lastWorkspace)}`} replace />
  }

  // No remembered workspace — fresh install, or an installed PWA's isolated
  // storage on first launch. Fall back to the first workspace the user belongs
  // to instead of rendering nothing: a blank index has no desktop sidebar to
  // mask it on mobile, so `return null` here shows as a black screen.
  if (isLoading) return null
  const fallback = workspaces.find((w) => w.workspace_member_name) ?? workspaces[0]
  if (!fallback) return null
  return <Navigate to={`/${encodeURIComponent(fallback.name)}`} replace />
}


/**
 * Data router (createBrowserRouter) rather than the declarative <BrowserRouter>:
 * React Router's View Transitions integration (`viewTransition` on links/navigate,
 * used for the desktop content cross-fade) only runs in data mode — declarative mode
 * silently ignores it. Same route tree; a data router must be created ONCE at module
 * scope, not per render.
 */
const router = createBrowserRouter(
  createRoutesFromElements(
    // errorElement: the last-resort boundary for uncaught render/route errors
    // anywhere in the tree (incl. stale-chunk failures after a deploy) — the
    // router swaps the view for ErrorPage instead of white-screening.
    <Route path="/" element={<AppShell />} errorElement={<ErrorPage />}>
      <Route index element={<IndexRedirect />} />
      {/* Workspace: channels and settings only; search is global at /search above */}
      <Route path=":workspaceID" element={<WorkspaceLayout />}>
        <Route index element={<WorkspaceRedirect />} />
        <Route path=":id" element={<Channel />}>
          <Route path="thread/:threadID" element={<ThreadDrawerRoute />} />
        </Route>
      </Route>
      <Route path="dm-channel" element={<DirectMessages />}>
        <Route index element={<DirectMessagesIndex />} />
        <Route path=":id" element={<DirectMessage />}>
          <Route path="thread/:threadID" element={<ThreadDrawerRoute />} />
        </Route>
      </Route>
      <Route path="notifications" element={<Notifications />}>
        <Route path=":channelID/:messageID?" element={<NotificationChatRoute />} />
      </Route>
      <Route path="threads" element={<Threads />}>
        <Route path=":threadID" element={<ThreadDrawerRoute />} />
      </Route>
      <Route path="search" element={<SearchLayout />}>
        <Route index element={<Suspense fallback={null}><Search /></Suspense>} />
      </Route>
      <Route path="saved-messages" element={<Suspense fallback={null}><SavedMessages /></Suspense>} />
      <Route path="profile" element={<Suspense fallback={null}><MobileProfile /></Suspense>} />
      {/* OS share sheet lands here (manifest share_target) — conversation picker */}
      <Route path="share-target" element={<Suspense fallback={null}><ShareTarget /></Suspense>} />
      {/* Permalink resolver — "Copy message link" always produces this route; it
          redirects to the message's real home (channel, DM, or thread). The
          fallback is the SAME skeleton the page renders while resolving, so
          chunk-load and data-load read as one continuous state. */}
      <Route
        path="message/:messageID"
        element={
          <Suspense fallback={<MessagePermalinkSkeleton />}>
            <MessagePermalink />
          </Suspense>
        }
      />
      {/* Catch-all 404. route.lazy (not React.lazy) is fine here — the brief
          blank-while-loading tradeoff doesn't matter for a page nobody lands
          on intentionally, and it keeps the chunk out of the main bundle. */}
      <Route path="*" lazy={() => import("@pages/NotFound")} />
      {/* TODO: when these settings routes come back, re-add their page imports as
          lazy() consts in the code-split block above — their old EAGER imports were
          removed (they sat in the main bundle for routes that didn't exist). */}
      {/* <Route path="settings" element={<AppSettings />}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<Profile />} />
        <Route path="preferences" element={<Preferences />} />
        <Route path="workspaces" element={<WorkspaceList />} />
        <Route path="channels" element={<ManageChannels />} />
        <Route path="emojis" element={<CustomEmojiList />} />
      </Route> */}
    </Route>,
  ),
  { basename: import.meta.env.VITE_BASE_NAME },
)

function App() {

  useEffect(() => {
    // Check if user is logged in by checking the Cookie "user_id"
    // In Frappe, unauthenticated users are "Guest"
    const userId = document.cookie?.split('; ').find(row => row.startsWith('user_id='))?.split('=')[1]?.trim()
    const isLoggedIn = userId !== 'Guest'

    if (!isLoggedIn) {
      if (import.meta.env.DEV) {
        return
      }
      // Redirect to Frappe login page with the correct redirect to the current route
      window.location.href = `/login?redirect-to=${window.location.pathname}`
      return
    }
  }, [])

  return (
    <LucideProvider
      strokeWidth={1.5}
    >
      <TooltipProvider>
        <FrappeProvider
          url={import.meta.env.VITE_FRAPPE_PATH ?? ''}
          socketPort={import.meta.env.VITE_SOCKET_PORT ? import.meta.env.VITE_SOCKET_PORT : undefined}
          swrConfig={{
            errorRetryCount: 2,
            // @ts-ignore - SWR config
            provider: localStorageProvider
          }}
          siteName={getSiteName()}
        >
          <RouterProvider router={router} />
          <Toaster />
        </FrappeProvider>
      </TooltipProvider>
    </LucideProvider>
  )
}

/** ----- SWR Caching ----- */

const CACHE_KEYS = [
  "raven.api.login.get_context",
  "workspaces_list",
  "channel_list",
]

function localStorageProvider() {
  // When initializing, we restore the data from `localStorage` into a map.
  // Check if local storage is recent (less than a week). Else start with a fresh cache.
  const timestamp = localStorage.getItem('app-cache-timestamp')
  let cache = '[]'
  if (timestamp && Date.now() - parseInt(timestamp) < 7 * 24 * 60 * 60 * 1000) {
    const localCache = localStorage.getItem('app-cache')
    if (localCache) {
      cache = localCache
    }
  }
  const map = new Map<string, string | number>(JSON.parse(cache))

  // Before unloading the app, we write back all the data into `localStorage`.
  window.addEventListener('beforeunload', () => {

    // Check if the user is logged in
    const user_id = Cookies.get('user_id')
    if (!user_id || user_id === 'Guest') {
      localStorage.removeItem('app-cache')
      localStorage.removeItem('app-cache-timestamp')
    } else {
      const entries = map.entries()

      const cacheEntries = []

      for (const [key, value] of entries) {

        let hasCacheKey = false
        for (const cacheKey of CACHE_KEYS) {
          if (key.includes(cacheKey)) {
            hasCacheKey = true
            break
          }
        }

        // Cache only the keys that are in CACHE_KEYS
        if (hasCacheKey) {
          cacheEntries.push([key, value])
        }
      }
      const appCache = JSON.stringify(cacheEntries)
      localStorage.setItem('app-cache', appCache)
      localStorage.setItem('app-cache-timestamp', Date.now().toString())
    }
  })

  // We still use the map for write & read for performance.
  return map
}

// Initialize emoji-mart (Apple set). Custom emojis are registered later, once
// fetched, via useRegisterCustomEmojis (re-init keeps this data).
initEmojiMart()

const getSiteName = () => {
  if (window.frappe?.boot?.versions?.frappe.startsWith('14')) {
    return import.meta.env.VITE_SITE_NAME
  }
  else {
    return window.frappe?.boot?.sitename ?? import.meta.env.VITE_SITE_NAME
  }
}


export default App
