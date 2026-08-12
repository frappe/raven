import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Spinner } from "@components/ui/spinner"
import { useTheme } from "@components/theme-provider"
import { useIsMobile } from "@hooks/use-mobile"

/**
 * Mirrors frappe-ui's ToastProvider.vue verbatim (their CURRENT toast — the
 * reka-ui Toast.vue still in that repo is the old component; don't align to
 * it). Same recipe: `unstyled` sonner with their exact class map. No custom
 * TYPE icons on either side — the filled glyphs are sonner's own defaults,
 * sized and colored through the `icon` class and tinted per type (error red,
 * warning amber; success and info stay neutral ink-base, matching them).
 * LOADING is the one deliberate departure: sonner's default 12-bar loader is
 * unsalvageable in unstyled mode, so loading toasts use our Espresso Spinner
 * (the icon class sizes it like every other glyph).
 *
 * Unstyled mode needs three small CSS patches (see "sonner (unstyled)" in
 * index.css), ported from their provider's <style> block.
 */
const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = "system" } = useTheme()
    const isMobile = useIsMobile()

    return (
        <Sonner
            theme={theme}
            className="toaster group"
            // Mobile: TOP-center — the bottom is where the composer and the tab
            // bar live, and a toast parked there blocks exactly what the user is
            // about to touch. The offset clears the notch/status bar in the
            // installed app (safe-area inset is 0 in a plain browser tab).
            position={isMobile ? "top-center" : "bottom-right"}
            mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
            closeButton
            expand={false}
            visibleToasts={3}
            icons={{ loading: <Spinner /> }}
            toastOptions={{
                unstyled: true,
                classNames: {
                    // max-w guard is ours: the fixed 360px card overflows viewports
                    // under ~392px (320px-class phones); inert everywhere else.
                    toast:
                        "group py-2.5 flex items-center px-4 bg-surface-gray-9 rounded-md shadow-xl w-[360px] max-w-[calc(100vw-2rem)] after:bg-transparent",
                    title: "text-p-base font-medium text-ink-base break-words",
                    description: "text-p-base text-ink-base break-words",
                    icon: "mr-2 text-ink-base [&_svg]:size-4",
                    // shrink-0 is ours (frappe-ui lacks it): the button is a flex
                    // child, so a long enough title squished it below size-5.
                    closeButton:
                        "order-1 ml-auto shrink-0 group-has-[[data-action]]:ml-0 grid place-items-center rounded-sm text-ink-base hover:bg-surface-gray-8 size-5 !transition-colors [&_svg]:size-4",
                    actionButton:
                        "flex shrink-0 text-ink-blue-link font-medium py-1.5 px-2 h-7 text-base mr-2 ml-auto bg-transparent hover:bg-surface-gray-8 rounded !transition-colors",
                    cancelButton:
                        "flex text-ink-blue-link font-medium py-1.5 px-2 text-base hover:bg-surface-gray-8 transition-colors",
                    error: "[&_[data-icon]]:text-ink-red-5",
                    warning: "[&_[data-icon]]:text-ink-amber-5",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
