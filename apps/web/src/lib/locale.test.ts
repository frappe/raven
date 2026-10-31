import { describe, expect, it } from "vitest"
import { applyLocale } from "./locale"

const htmlTag = () => ({ lang: "", dir: "" }) as HTMLElement

describe("applyLocale", () => {
    it("sets the language and right to left direction from the boot", () => {
        const root = htmlTag()
        applyLocale({ lang: "ar", layout_direction: "rtl" }, root)
        expect([root.lang, root.dir]).toEqual(["ar", "rtl"])
    })

    it("stays left to right for a boot from a server that does not send a direction", () => {
        const root = htmlTag()
        applyLocale({ lang: "ar" }, root)
        expect(root.dir).toBe("ltr")
    })
})
