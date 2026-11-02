/**
 * iOS's feedback types: impacts (light / medium / heavy) for a gesture landing,
 * notifications (success / warning / error) for an outcome, e.g. warning for a
 * voice note too short to send, error for one thrown away.
 */
export type HapticKind = "light" | "medium" | "heavy" | "success" | "warning" | "error"

// Web approximations where the browser can vibrate (Android).
const VIBRATION: Record<HapticKind, number | number[]> = {
    light: 8,
    medium: 15,
    heavy: 25,
    success: [10, 60, 15],
    warning: [15, 60, 15],
    error: [15, 60, 15, 60, 15],
}

/**
 * Best-effort haptic for gesture feedback (long-press, quick react). In the app,
 * the native iOS type; medium by default.
 *
 * Android / Chrome: navigator.vibrate. iOS Safari has NO vibration API — the
 * only web-reachable haptic is the system tick that accompanies toggling a
 * native switch control (`input[switch]`, Safari 17.4+). The exact recipe
 * matters: the input must be wrapped in a <label> and the LABEL clicked —
 * label activation is the path WebKit attaches the haptic to (clicking the
 * input directly stays silent). Requires transient user activation, so call
 * this only from (or shortly after) a user gesture. Silently a no-op on
 * platforms with neither. Haptics are decoration — never throw.
 */
export const hapticTick = (kind: HapticKind = "medium") => {
    if (import.meta.env.VITE_NATIVE) { import("../native/haptics").then((m) => m.nativeHapticTick(kind)); return }
    try {
        if (navigator.vibrate?.(VIBRATION[kind])) return
        const label = document.createElement("label")
        label.ariaHidden = "true"
        label.style.display = "none"
        const toggle = document.createElement("input")
        toggle.type = "checkbox"
        toggle.setAttribute("switch", "")
        label.appendChild(toggle)
        document.body.appendChild(label)
        label.click()
        label.remove()
    } catch {
        // never let feedback break the gesture
    }
}
