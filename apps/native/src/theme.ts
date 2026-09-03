/** The in-app choice pins the picker; "system"/unknown falls back to the media query. */
export const themeClass = (value: string | null | undefined): "dark" | "light" | null =>
    value === "dark" || value === "light" ? value : null
