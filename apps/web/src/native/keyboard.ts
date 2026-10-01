import { listenNative } from "./platform"

// OS keyboard events via the plugin: WKWebView's visualViewport reports the keyboard late or not at all.
// keyboardHeight arrives in CSS px, ready for the --keyboard-height variable.
export const subscribeNativeKeyboard = (onChange: (open: boolean, height: number) => void): (() => void) => {
    const unShow = listenNative(async () => (await import("@capacitor/keyboard")).Keyboard.addListener("keyboardWillShow", (e) => onChange(true, e.keyboardHeight)))
    const unHide = listenNative(async () => (await import("@capacitor/keyboard")).Keyboard.addListener("keyboardWillHide", () => onChange(false, 0)))
    return () => { unShow(); unHide() }
}

// The page never resizes for the keyboard; the composer lifts itself by this variable instead.
export const trackKeyboardInset = (): (() => void) => {
    const root = document.documentElement
    const unsubscribe = subscribeNativeKeyboard((_open, height) => root.style.setProperty("--keyboard-height", `${height}px`))
    return () => { unsubscribe(); root.style.removeProperty("--keyboard-height") }
}
