// Capacitor Preferences keys shared by the shell (apps/native) and the web app
// (apps/web/src/native). Native code reads some of them too: Android
// SharedPreferences "CapacitorStorage", iOS UserDefaults "CapacitorStorage.<key>".

/** Site origin the shell auto-opens at launch. */
export const DEFAULT_SITE_KEY = "defaultSite"
/** Epoch ms of the last auto-open; the web app clears it once it has loaded. */
export const LAST_AUTO_NAV_KEY = "lastAutoNav"
/** In-app theme choice ("light" | "dark" | "system"), mirrored for the native canvas. */
export const APP_THEME_KEY = "appTheme"
/** FCM token the web app subscribed for one site, so the shell can unsubscribe when the site is removed. */
export const pushTokenKey = (origin: string) => `pushToken.${origin}`
