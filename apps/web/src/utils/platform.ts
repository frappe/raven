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
