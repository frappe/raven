type Boot = { lang?: string; layout_direction?: string }

/** The page direction from the boot. A boot without it (an older server) stays left to right. */
export const layoutDirection = (boot: Boot): "ltr" | "rtl" => (boot.layout_direction === "rtl" ? "rtl" : "ltr")

/** 1 left to right, -1 right to left. A horizontal distance times this is measured along the line. */
export const lineSign = (direction: string): 1 | -1 => (direction === "rtl" ? -1 : 1)

/**
 * Puts the user's language and direction on the html tag. The server page already has them,
 * but the dev server, the offline shell and the native app start from a plain html file.
 */
export const applyLocale = (boot: Boot) => {
    document.documentElement.lang = boot.lang || "en"
    document.documentElement.dir = layoutDirection(boot)
}

const FIRST_LETTER = /\p{L}/u
const RIGHT_TO_LEFT_LETTER = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u

/**
 * The direction of text someone wrote, from its first letter: Arabic, Hebrew and the like
 * read right to left, every other letter left to right. Text with no letters (empty, emoji,
 * numbers) gives undefined, so it keeps the interface direction. `dir="auto"` and CSS can't
 * do that last part: browsers turn such text left to right.
 */
export const textDirection = (text: string | null | undefined): "ltr" | "rtl" | undefined => {
    const letter = text?.match(FIRST_LETTER)?.[0]
    if (!letter) return undefined
    return RIGHT_TO_LEFT_LETTER.test(letter) ? "rtl" : "ltr"
}

/**
 * Month and day names, and "2 hours ago", for the languages Raven is translated into. Each one
 * is its own small file, loaded only for that language. English is built into dayjs.
 * Keyed by Frappe's language codes.
 */
const DATE_LOCALES: Record<string, () => Promise<{ default: { name: string } }>> = {
    ar: () => import("dayjs/locale/ar"),
    de: () => import("dayjs/locale/de"),
    es: () => import("dayjs/locale/es"),
    fa: () => import("dayjs/locale/fa"),
    fr: () => import("dayjs/locale/fr"),
    hi: () => import("dayjs/locale/hi"),
    id: () => import("dayjs/locale/id"),
    "pt-BR": () => import("dayjs/locale/pt-br"),
    tr: () => import("dayjs/locale/tr"),
    zh: () => import("dayjs/locale/zh-cn"),
}

/** The dayjs locale name for a language, loaded if it is not English. "en" when there is none. */
export const loadDateLocale = async (lang = "en"): Promise<string> => {
    const load = DATE_LOCALES[lang] ?? DATE_LOCALES[lang.split("-")[0]]
    if (!load) return "en"
    try {
        return (await load()).default.name
    } catch {
        // Offline before the file was cached: dates show in English.
        return "en"
    }
}
