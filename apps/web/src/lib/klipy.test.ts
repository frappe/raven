import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildGifHtml, fetchGifs, isKlipyMediaUrl, localeFromLanguage, pickMedia, registerShare, type KlipyGif, type KlipyMedia } from "./klipy"

const media = (url: string, width = 498, height = 280) => ({ url, width, height })
const gif = (over: Partial<KlipyGif> = {}): KlipyGif => ({
    id: 1,
    slug: "hello-hi-662",
    title: "Hello",
    type: "gif",
    file: {
        md: { webp: media("https://static.klipy.com/ii/a?x=1&y=2"), gif: media("https://static.klipy.com/ii/b") },
        sm: { gif: media("https://static.klipy.com/ii/c", 220, 124) },
    },
    ...over,
})

describe("isKlipyMediaUrl", () => {
    it("accepts the three KLIPY media hosts over https", () => {
        expect(isKlipyMediaUrl("https://static.klipy.com/ii/a")).toBe(true)
        expect(isKlipyMediaUrl("https://static1.klipy.com/ii/a")).toBe(true)
        expect(isKlipyMediaUrl("https://static2.klipy.com/ii/a")).toBe(true)
    })

    it("rejects other hosts, lookalikes and other schemes", () => {
        for (const src of ["https://evil.com/a", "https://static.klipy.com.evil.com/a", "http://static.klipy.com/a", "javascript:alert(1)", "/files/a.gif", ""])
            expect(isKlipyMediaUrl(src)).toBe(false)
    })
})

describe("pickMedia", () => {
    it("prefers webp", () => expect(pickMedia(gif(), "md")?.url).toBe("https://static.klipy.com/ii/a?x=1&y=2"))
    it("falls back to gif", () => expect(pickMedia(gif(), "sm")?.url).toBe("https://static.klipy.com/ii/c"))
    it("is undefined when the size is missing", () => expect(pickMedia(gif({ file: {} }), "md")).toBeUndefined())
    it("is undefined for an item with no file at all", () => {
        expect(pickMedia({ ...gif(), file: undefined } as unknown as KlipyGif, "md")).toBeUndefined()
    })
})

describe("buildGifHtml", () => {
    it("stores the URL as returned, with size and slug", () => {
        expect(buildGifHtml(gif())).toBe(
            '<p><img data-type="gif" src="https://static.klipy.com/ii/a?x=1&amp;y=2" alt="Hello" width="498" height="280" data-klipy-slug="hello-hi-662"></p>',
        )
    })

    it("escapes quotes and angle brackets in the title", () => {
        expect(buildGifHtml(gif({ title: `"><script>` }))).toContain('alt="&quot;&gt;&lt;script&gt;"')
    })

    it("sends with an empty alt when KLIPY gives no title", () => {
        expect(buildGifHtml(gif({ title: undefined }))).toContain('alt=""')
    })

    it("is null without medium media", () => expect(buildGifHtml(gif({ file: {} }))).toBeNull())

    it("is null when the media is not on a KLIPY host", () => {
        expect(buildGifHtml(gif({ file: { md: { webp: media("https://evil.com/a.webp") } } }))).toBeNull()
    })

    it("leaves out sizes that are not numbers", () => {
        const broken = { url: "https://static.klipy.com/ii/a", width: '1" onerror="x', height: Number.NaN } as unknown as KlipyMedia
        const html = buildGifHtml(gif({ file: { md: { webp: broken } } }))
        expect(html).toBe('<p><img data-type="gif" src="https://static.klipy.com/ii/a" alt="Hello" data-klipy-slug="hello-hi-662"></p>')
    })
})

describe("localeFromLanguage", () => {
    it("takes the region", () => expect(localeFromLanguage("en-US")).toBe("us"))
    it("is undefined without a region", () => expect(localeFromLanguage("en")).toBeUndefined())
    it("is undefined without a language", () => expect(localeFromLanguage(undefined)).toBeUndefined())
})

describe("fetchGifs", () => {
    beforeEach(() => vi.stubGlobal("window", { frappe: { boot: { klipy_api_key: "BOOT", raven_klipy_customer_id: "c1" } } }))
    afterEach(() => vi.unstubAllGlobals())
    const ok = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body })
    const page = { result: true, data: { data: [gif()], current_page: 2, per_page: 24, has_next: true } }

    it("calls trending for an empty query, with the boot key and customer id", async () => {
        const fetch = ok(page)
        vi.stubGlobal("fetch", fetch)
        await fetchGifs({ query: "  ", page: 1 })
        const url = new URL(String(fetch.mock.calls[0][0]))
        expect(url.origin + url.pathname).toBe("https://api.klipy.com/api/v1/BOOT/gifs/trending")
        expect(url.searchParams.get("customer_id")).toBe("c1")
        expect(url.searchParams.has("q")).toBe(false)
    })

    it("calls search with the trimmed query and page", async () => {
        const fetch = ok(page)
        vi.stubGlobal("fetch", fetch)
        await fetchGifs({ query: " this is fine ", page: 2 })
        const url = new URL(String(fetch.mock.calls[0][0]))
        expect(url.pathname).toBe("/api/v1/BOOT/gifs/search")
        expect(url.searchParams.get("q")).toBe("this is fine")
        expect(url.searchParams.get("page")).toBe("2")
        expect(url.searchParams.get("per_page")).toBe("24")
    })

    it("maps the response and keeps KLIPY's order", async () => {
        vi.stubGlobal("fetch", ok(page))
        expect(await fetchGifs({ query: "", page: 2 })).toEqual({ items: [gif()], page: 2, hasNext: true })
    })

    it("fails without a key", async () => {
        vi.stubGlobal("window", { frappe: { boot: {} } })
        await expect(fetchGifs({ query: "", page: 1 })).rejects.toMatchObject({ name: "KlipyError", status: 0 })
    })

    it("carries KLIPY's status, so a 429 reads as rate limited", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }))
        await expect(fetchGifs({ query: "", page: 1 })).rejects.toMatchObject({ name: "KlipyError", status: 429 })
    })

    it("reports a network failure as status 0", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
        await expect(fetchGifs({ query: "", page: 1 })).rejects.toMatchObject({ name: "KlipyError", status: 0 })
    })

    it("reports a body that is not JSON as a KLIPY error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <") } }))
        await expect(fetchGifs({ query: "", page: 1 })).rejects.toMatchObject({ name: "KlipyError", status: 200 })
    })

    it("gives up after 10 seconds when KLIPY never answers", async () => {
        vi.useFakeTimers()
        // Settles only when its signal aborts, like a hung request.
        vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))))
        const result = expect(fetchGifs({ query: "", page: 1 })).rejects.toMatchObject({ name: "KlipyError", status: 0 })
        await vi.advanceTimersByTimeAsync(10_000)
        await result
        vi.useRealTimers()
    })
})

describe("registerShare", () => {
    beforeEach(() => vi.stubGlobal("window", { frappe: { boot: { klipy_api_key: "BOOT", raven_klipy_customer_id: "c1" } } }))
    afterEach(() => vi.unstubAllGlobals())

    it("posts the share with keepalive, so leaving the channel doesn't cancel it", () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true })
        vi.stubGlobal("fetch", fetch)
        registerShare("hello-hi-662", " this is fine ")
        const [url, init] = fetch.mock.calls[0]
        expect(url).toBe("https://api.klipy.com/api/v1/BOOT/gifs/share/hello-hi-662")
        expect(init).toMatchObject({ method: "POST", keepalive: true })
        expect(JSON.parse(init.body)).toEqual({ customer_id: "c1", q: "this is fine" })
    })
})
