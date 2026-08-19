import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate } from "react-router-dom"
import Channel from "@pages/workspace/Channel"
import Notifications from "@pages/notifications/Notifications"
import NotificationChatRoute from "@pages/notifications/NotificationChatRoute"
import { MessagePermalinkSkeleton } from "@pages/message/MessagePermalinkSkeleton"
import { ProfilePageSkeleton } from "@pages/profile/ProfilePageSkeleton"
import { ShareTargetSkeleton } from "@pages/share/ShareTargetSkeleton"
import { ListPageSkeleton } from "@components/layout/ListPageSkeleton"
import _ from "@lib/translate"
import ErrorPage from "@pages/ErrorPage"
import Threads from "@pages/threads/Threads"
import DirectMessages, { DirectMessagesIndex } from "@pages/dm-channel/DirectMessages"
import DirectMessage from "@pages/dm-channel/DirectMessage"
import ThreadDrawerRoute from "@components/features/message/ThreadDrawerRoute"
import { WorkspaceRedirect } from "@components/workspace-switcher/WorkspaceRedirect"
import { FrappeProvider } from 'frappe-react-sdk'
import { redirectToLoginIfSessionDied } from '@lib/authRecovery'
import { initEmojiMart } from '@lib/emojiMart'
import Cookies from 'js-cookie'
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
// Every lazy route gets a silhouette of its own layout as its Suspense
// fallback — chunk-load must never flash blank. On mobile the tab bar lives
// INSIDE each page's chunk, so the fallbacks mount the real (eager) footer:
// the frame stays put and the tabs stay tappable during the load.
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

  // Decide only once the workspace list is known — otherwise a deleted
  // lastWorkspace can't be told apart from one that just hasn't loaded yet.
  if (isLoading) return null

  // Reopen the remembered workspace only if it STILL EXISTS — it may have been
  // deleted (here or by another admin) or the user removed from it, leaving the
  // atom stale. Desktop reopens the exact channel; mobile lands on the
  // workspace's channel list (the channel pair is written together).
  const lastExists = lastWorkspace && workspaces.some((w) => w.name === lastWorkspace)
  if (lastExists) {
    if (lastChannel && !isMobile) {
      return <Navigate to={`/${encodeURIComponent(lastWorkspace)}/${encodeURIComponent(lastChannel)}`} replace />
    }
    return <Navigate to={`/${encodeURIComponent(lastWorkspace)}`} replace />
  }

  // No valid remembered workspace — fresh install, an installed PWA's isolated
  // storage on first launch, or a stale/deleted one. Fall back to the first
  // workspace the user belongs to instead of rendering nothing: a blank index
  // has no desktop sidebar to mask it on mobile, so `return null` shows black.
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
      {/* The `key` on every lazy route's Suspense is LOAD-BEARING. Adjacent
          lazy routes render the same shape at the same Outlet position, so
          without keys React reconciles them into ONE reused Suspense instance
          — and a reused boundary suspending inside a router transition keeps
          showing its old content (the previous PAGE) instead of the fallback.
          Keys force a fresh boundary per route; a new boundary shows its
          skeleton immediately, even mid-transition. */}
      <Route path="search" element={<Suspense key="search" fallback={<ListPageSkeleton title={_("Search")} />}><Search /></Suspense>}>
        <Route path=":channelID/:messageID" element={<NotificationChatRoute />} />
      </Route>
      <Route path="saved-messages" element={<Suspense key="saved-messages" fallback={<ListPageSkeleton title={_("Saved Messages")} />}><SavedMessages /></Suspense>}>
        <Route path=":channelID/:messageID" element={<NotificationChatRoute />} />
      </Route>
      {/* Fallback = the page's silhouette WITH the real tab bar: the footer
          lives inside this lazy chunk, so a null fallback blanked the whole
          screen (footer included) for the duration of the load. */}
      <Route path="profile" element={<Suspense key="profile" fallback={<ProfilePageSkeleton />}><MobileProfile /></Suspense>} />
      {/* OS share sheet lands here (manifest share_target) — conversation picker */}
      <Route path="share-target" element={<Suspense key="share-target" fallback={<ShareTargetSkeleton />}><ShareTarget /></Suspense>} />
      {/* Permalink resolver — "Copy message link" always produces this route; it
          redirects to the message's real home (channel, DM, or thread). The
          fallback is the SAME skeleton the page renders while resolving, so
          chunk-load and data-load read as one continuous state. */}
      <Route
        path="message/:messageID"
        element={
          <Suspense key="message-permalink" fallback={<MessagePermalinkSkeleton />}>
            <MessagePermalink />
          </Suspense>
        }
      />
      {/* Catch-all 404. route.lazy (not React.lazy) is fine here — the brief
          blank-while-loading tradeoff doesn't matter for a page nobody lands
          on intentionally, and it keeps the chunk out of the main bundle. */}
      <Route path="*" lazy={() => import("@pages/NotFound")} />
    </Route>,
  ),
  { basename: import.meta.env.VITE_BASE_NAME },
)

function App() {

  // Login check, SYNCHRONOUS and before the router renders. It used to live in
  // a post-paint effect, so a logged-out visitor rendered the whole app for a
  // few frames — ProtectedRoute's "no access" alert flashed — before the
  // redirect kicked in. Checked during render, we paint nothing instead while
  // the browser navigates to login. (Frappe marks anonymous visitors with
  // user_id=Guest; dev builds skip the redirect — there's no local login page.)
  const userId = Cookies.get('user_id')
  const isLoggedIn = !!userId && userId !== 'Guest'
  const shouldRedirectToLogin = !isLoggedIn && !import.meta.env.DEV

  useEffect(() => {
    if (shouldRedirectToLogin) {
      window.location.href = `/login?redirect-to=${window.location.pathname}`
    }
  }, [shouldRedirectToLogin])

  if (shouldRedirectToLogin) {
    return null
  }

  return (
    <LucideProvider
      strokeWidth={1.5}
    >
      <TooltipProvider>
        <FrappeProvider
          url={import.meta.env.VITE_FRAPPE_PATH ?? ''}
          socketPort={import.meta.env.VITE_SOCKET_PORT ? import.meta.env.VITE_SOCKET_PORT : undefined}
          swrConfig={{
            // NO global errorRetryCount: SWR's default retry is UNLIMITED
            // exponential backoff, and that's what we want for the fetches
            // that gate the whole UI (channel list etc.) — a cap here once
            // stranded cold starts on flaky networks on skeletons forever.
            // Hooks that shouldn't retry set shouldRetryOnError/errorRetryCount
            // themselves.
            // Dead-session recovery: Frappe rewrites the user_id cookie to
            // "Guest" on the failing response itself, so any fetch error while
            // the cookie says Guest means the session is gone — go to login.
            onError: redirectToLoginIfSessionDied,
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
  "message-actions-list",
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
