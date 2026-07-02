import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Profile from "./pages/settings/Profile"
import Channel from "@pages/workspace/Channel"
import Notifications from "@pages/notifications/Notifications"
import SavedMessages from "@pages/saved-messages/SavedMessages"
import Search from "@pages/search/Search"
import Threads from "@pages/threads/Threads"
import DirectMessages, { DirectMessagesIndex } from "@pages/dm-channel/DirectMessages"
import DirectMessage from "@pages/dm-channel/DirectMessage"
import ThreadDrawerRoute from "@components/features/message/ThreadDrawerRoute"
import { WorkspaceRedirect } from "@components/workspace-switcher/WorkspaceRedirect"
import { FrappeProvider } from 'frappe-react-sdk'
import { initEmojiMart } from '@lib/emojiMart'
import Cookies from 'js-cookie'
import WorkspaceList from "@pages/settings/Workspaces/WorkspaceList"
import { SearchLayout } from "@components/layout/SearchLayout"
import CustomEmojiList from "@pages/settings/CustomEmojiList/CustomEmojiList"
import { ManageChannels } from "@pages/settings/Channels/ManageChannels"
import { Toaster } from "@components/ui/sonner"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { LucideProvider } from "lucide-react"
import { useEffect } from "react"
import AppShell from "@components/layout/AppShell"
import { useAtomValue } from "jotai"
import { lastChannelAtom, lastWorkspaceAtom } from "@utils/lastVisitedAtoms"
import { useIsMobile } from "@hooks/use-mobile"
import { useWorkspaces } from "@hooks/useWorkspaces"
import WorkspaceLayout from "@pages/workspace/WorkspaceLayout"

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
          <BrowserRouter basename={import.meta.env.VITE_BASE_NAME}>
            <Routes>
              <Route path="/" element={<AppShell />}>
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
                <Route path="notifications" element={<Notifications />} />
                <Route path="threads" element={<Threads />}>
                  <Route path=":threadID" element={<ThreadDrawerRoute />} />
                </Route>
                <Route path="search" element={<SearchLayout />}>
                  <Route index element={<Search />} />
                </Route>
                <Route path="saved-messages" element={<SavedMessages />} />
                {/* <Route path="settings" element={<AppSettings />}>
                  <Route index element={<Navigate to="profile" replace />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="preferences" element={<Preferences />} />
                  <Route path="workspaces" element={<WorkspaceList />} />
                  <Route path="channels" element={<ManageChannels />} />
                  <Route path="emojis" element={<CustomEmojiList />} />
                </Route> */}
              </Route>
            </Routes>
            <Toaster />
          </BrowserRouter>
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
