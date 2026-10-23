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

    it("gives up on a fetch that stalls and shows the source strings", async () => {
        vi.useFakeTimers()
        // Never answers on its own; rejects only when the loader's signal aborts it.
        siteFetch.mockImplementation((_path: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
        }))
        const loading = loadTranslations({ lang: "tr", translations_version: "abc_1" })
        await vi.advanceTimersByTimeAsync(8_000)
        await loading
        expect(window.frappe._messages).toEqual({})
        vi.useRealTimers()
    })

    it("falls back to the source strings when the fetch fails", async () => {
        siteFetch.mockRejectedValue(new Error("offline"))
        await loadTranslations({ lang: "tr", translations_version: "abc_1" })
        expect(window.frappe._messages).toEqual({})
    })
})
