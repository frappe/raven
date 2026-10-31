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
