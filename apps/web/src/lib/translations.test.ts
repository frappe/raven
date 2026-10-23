import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadTranslations } from "./translations"

const siteFetch = vi.fn()
vi.mock("@lib/site", () => ({ siteFetch: (...args: unknown[]) => siteFetch(...args) }))

describe("loadTranslations", () => {
    beforeEach(() => {
        vi.stubGlobal("window", {})
        siteFetch.mockReset()
    })

    it("takes the table from a boot that carries it, as Frappe 15 and 16 do", async () => {
        await loadTranslations({ lang: "tr", __messages: { Hello: "Merhaba" } })
        expect(window.frappe._messages).toEqual({ Hello: "Merhaba" })
        expect(siteFetch).not.toHaveBeenCalled()
    })

    it("fetches the table by version and language when the boot has only a version stamp", async () => {
        siteFetch.mockResolvedValue({ ok: true, json: async () => ({ message: { Hello: "Merhaba" } }) })
        await loadTranslations({ lang: "tr", translations_version: "abc_1" })
        expect(siteFetch.mock.calls[0][0]).toBe("/api/method/frappe.translate.get_boot_translations?v=abc_1&lang=tr")
        expect(window.frappe._messages).toEqual({ Hello: "Merhaba" })
    })

    it("falls back to the source strings when the fetch fails", async () => {
        siteFetch.mockRejectedValue(new Error("offline"))
        await loadTranslations({ lang: "tr", translations_version: "abc_1" })
        expect(window.frappe._messages).toEqual({})
    })
})
