import "react"

/**
 * emoji-mart registers the `<em-emoji>` custom element when `init()` runs
 * (see App.tsx — initialized with the Apple set so emojis render identically
 * on every platform). emoji-mart ships no JSX types for it, so we declare the
 * attributes we use here (React 19 keeps JSX under the react module).
 */
declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "em-emoji": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                /** Render by raw unicode emoji, e.g. "❤️" */
                native?: string
                /** Render by shortcode, e.g. ":heart:" */
                shortcodes?: string
                size?: string
                set?: "native" | "apple" | "facebook" | "google" | "twitter"
                skin?: string | number
                /** Shown when the emoji can't be found in the set's data */
                fallback?: string
            }
        }
    }
}
