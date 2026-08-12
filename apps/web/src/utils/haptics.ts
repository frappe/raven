/**
 * Best-effort haptic tick for gesture feedback (long-press, quick react).
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
export const hapticTick = () => {
    try {
        if (navigator.vibrate?.(10)) return
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
