// WKWebView's visualViewport lags the keyboard; the plugin events are exact.
export const subscribeNativeKeyboard = (onChange: (open: boolean) => void): (() => void) => {
    let disposed = false
    const handles: Array<{ remove: () => Promise<void> }> = []
    const drop = (h: { remove: () => Promise<void> }) => h.remove().catch(() => { })
    import("@capacitor/keyboard").then(async ({ Keyboard }) => {
        if (disposed) return
        const show = await Keyboard.addListener("keyboardWillShow", () => onChange(true))
        if (disposed) { drop(show); return }
        handles.push(show)
        const hide = await Keyboard.addListener("keyboardWillHide", () => onChange(false))
        if (disposed) { drop(hide); return }
        handles.push(hide)
    }).catch(() => { })
    return () => { disposed = true; handles.forEach(drop) }
}
