import { useEffect, useState } from "react"
import type { Editor } from "@tiptap/react"

/**
 * True while the on-screen keyboard is (likely) open *for the given composer editor*.
 *
 * iOS keeps `env(safe-area-inset-bottom)` reporting the home-indicator inset even when the
 * keyboard covers that area, so composer padding meant to clear the indicator turns into dead
 * space floating above the keyboard. Consumers drop that padding when this returns true.
 *
 * Scoped + blur-accurate by design: the primary signal is the editor's own focus (`editor.isFocused`
 * driven by its `focus`/`blur` events), so an unrelated input elsewhere on screen can't flip it, and
 * ProseMirror's reliable `blur` event is the backstop that restores the padding. The visualViewport
 * shrink is a secondary signal — pure viewport math is flaky in a standalone iOS PWA (innerHeight can
 * shrink with the keyboard, and page scroll eats the gap), so it's an OR, not the source of truth.
 *
 * Pass `enabled: false` (e.g. on desktop, where the result is unused) to skip the focus +
 * visualViewport listeners entirely — it just returns false.
 */
export function useIsKeyboardOpen(editor: Editor | null, enabled = true): boolean {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (!enabled) return
        const vv = window.visualViewport

        const compute = () => {
            const gap = vv ? window.innerHeight - vv.height - vv.offsetTop : 0
            setOpen((editor?.isFocused ?? false) || gap > 120)
        }

        compute()
        const onFocus = () => setOpen(true)
        // On blur, recompute rather than force-false: the keyboard may still be up for another
        // reason (viewport gap). editor.isFocused is already false by the time `blur` fires.
        const onBlur = () => compute()

        // App switches desync BOTH signals, leaving the composer stuck padding-less
        // with no keyboard: iOS closes the keyboard on backgrounding but never blurs
        // the editor (isFocused stays true), and visualViewport resize events that
        // would correct a stale `gap` are dropped while the page is frozen. A hidden
        // app has no keyboard by definition — blur explicitly (tap-to-resume-typing
        // is the native behavior) and reset; recompute fresh on return.
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                editor?.commands.blur()
                setOpen(false)
            } else {
                compute()
            }
        }

        editor?.on("focus", onFocus)
        editor?.on("blur", onBlur)
        vv?.addEventListener("resize", compute)
        vv?.addEventListener("scroll", compute)
        document.addEventListener("visibilitychange", onVisibilityChange)

        return () => {
            editor?.off("focus", onFocus)
            editor?.off("blur", onBlur)
            vv?.removeEventListener("resize", compute)
            vv?.removeEventListener("scroll", compute)
            document.removeEventListener("visibilitychange", onVisibilityChange)
        }
    }, [editor, enabled])

    return open
}
