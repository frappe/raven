/**
 * UA-based platform checks, for the few places where iOS and Android need
 * different NATIVE behavior (file-input capture intents, keyboard quirks).
 * Prefer feature detection when one exists — these are the last resort.
 */
export const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)

/** iPadOS masquerades as Mac — the touch-points check catches it. */
export const isIOS = typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))

/**
 * Running as an INSTALLED app (home screen / desktop PWA) rather than a browser
 * tab. Installation is a personal-device signal — offline persistence of user
 * data (rendered shell, boot cache) is gated on it, so shared-machine browser
 * sessions leave nothing extra at rest.
 */
export const isStandalone = (): boolean =>
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS home-screen apps report through navigator.standalone instead
    (navigator as { standalone?: boolean }).standalone === true
