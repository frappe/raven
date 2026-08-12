import { scan } from "react-scan";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from "./components/theme-provider"

scan({
  enabled: true,
});


import { initPushNotifications, isStandalone } from "@lib/push";

if (import.meta.env.DEV) {
  fetch('/api/method/raven.www.raven.get_context_for_dev', {
    method: 'POST',
  })
    .then(response => response.json())
    .then((values) => {
      const v = JSON.parse(values.message)
      if (!window.frappe) window.frappe = {};
      window.frappe.boot = v
      window.frappe._messages = window.frappe.boot["__messages"];
      // After boot lands — push config (firebase_client_config) comes from it
      initPushNotifications()
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </StrictMode>,
      )
    }
    )
} else {
  // Boot is inlined by the Jinja entry template. An OFFLINE (app-shell) load
  // serves the BUILT index.html from the service worker's cache instead — its
  // Jinja is unrendered, so the whole inline boot script fails to parse and
  // window.frappe never gets set. Recover the last ONLINE load's boot from
  // localStorage so the shell still knows who you are, your settings, etc.
  if (!window.frappe?.boot) {
    try {
      const cached = localStorage.getItem("raven-boot-cache")
      if (cached) {
        if (!window.frappe) window.frappe = {}
        window.frappe.boot = JSON.parse(cached)
        window.frappe._messages = window.frappe.boot["__messages"]
      }
    } catch {
      // No usable cached boot — the shell still renders; boot readers degrade.
    }
  } else if (isStandalone()) {
    // Fresh server boot — cache it for offline launches, off the critical path.
    // Installed app only: browser-tab sessions shouldn't leave boot at rest on
    // a possibly-shared machine (and don't get the offline shell anyway).
    window.setTimeout(() => {
      try {
        localStorage.setItem("raven-boot-cache", JSON.stringify(window.frappe.boot))
      } catch {
        // Quota/private mode — offline loads just won't have boot.
      }
    }, 3000)
  }
  initPushNotifications()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  )
}
