type Boot = { lang?: string; layout_direction?: string }

/** The page direction from the boot. A boot without it (an older server) stays left to right. */
export const layoutDirection = (boot: Boot): "ltr" | "rtl" => (boot.layout_direction === "rtl" ? "rtl" : "ltr")

/**
 * Puts the user's language and direction on the html tag. The server page already has them,
 * but the dev server, the offline shell and the native app start from a plain html file.
 */
export const applyLocale = (boot: Boot, root: HTMLElement = document.documentElement) => {
    root.lang = boot.lang || "en"
    root.dir = layoutDirection(boot)
}
