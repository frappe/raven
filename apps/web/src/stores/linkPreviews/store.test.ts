import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { linkPreviewStore, type FrappeCallClient, type LinkPreviewData } from "./store"

const preview = (overrides: Partial<LinkPreviewData> = {}): LinkPreviewData => ({
    url: "https://example.com/a",
    provider: "Other",
    status: "Fetched",
    title: "Title",
    description: "",
    image: "",
    image_width: 0,
    image_height: 0,
    site_name: "example.com",
    metadata: null,
    ...overrides,
})

/** A fake FrappeCallClient whose responses are queued by the test. */
const makeClient = () => {
    const calls: Array<{ method: string; params?: Record<string, unknown> }> = []
    let responder: (urls: string[]) => Record<string, LinkPreviewData | null> = () => ({})
    const post = vi.fn(async (method: string, params?: Record<string, unknown>) => {
        calls.push({ method, params })
        const urls = (params?.urls as string[]) ?? []
        return { message: responder(urls) }
    })
    return {
        calls,
        post,
        respondWith(fn: (urls: string[]) => Record<string, LinkPreviewData | null>) {
            responder = fn
        },
        // The store wants the generic FrappeCallClient shape; the mock's
        // concrete return type needs this cast.
        forStore: { post } as unknown as FrappeCallClient,
    }
}

describe("linkPreviewStore", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        linkPreviewStore.reset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("batches registrations from one screen into one call", async () => {
        const client = makeClient()
        client.respondWith(() => ({
            "https://example.com/a": preview(),
            "https://example.com/b": null,
        }))
        linkPreviewStore.setClient(client.forStore)

        linkPreviewStore.register("https://example.com/a")
        linkPreviewStore.register("https://example.com/b")
        await vi.runAllTimersAsync()

        expect(client.post).toHaveBeenCalledTimes(1)
        expect(linkPreviewStore.get("https://example.com/a")?.title).toBe("Title")
        // The server had nothing: entry is null, not undefined.
        expect(linkPreviewStore.get("https://example.com/b")).toBeNull()
    })

    it("never refetches a known url", async () => {
        const client = makeClient()
        client.respondWith(() => ({ "https://example.com/a": preview() }))
        linkPreviewStore.setClient(client.forStore)

        linkPreviewStore.register("https://example.com/a")
        await vi.runAllTimersAsync()
        linkPreviewStore.register("https://example.com/a")
        await vi.runAllTimersAsync()

        expect(client.post).toHaveBeenCalledTimes(1)
    })

    it("notifies subscribers when a batch lands", async () => {
        const client = makeClient()
        client.respondWith(() => ({ "https://example.com/a": preview() }))
        linkPreviewStore.setClient(client.forStore)

        const onChange = vi.fn()
        linkPreviewStore.subscribe("https://example.com/a", onChange)
        linkPreviewStore.register("https://example.com/a")
        await vi.runAllTimersAsync()

        expect(onChange).toHaveBeenCalled()
    })

    it("patches every raw spelling from a realtime event via the normalized url", async () => {
        const client = makeClient()
        // Two raw spellings share one normalized row, still Pending.
        client.respondWith(() => ({
            "https://example.com/a?utm_source=x": preview({ status: "Pending", title: "" }),
            "https://example.com/a": preview({ status: "Pending", title: "" }),
        }))
        linkPreviewStore.setClient(client.forStore)

        linkPreviewStore.register("https://example.com/a?utm_source=x")
        linkPreviewStore.register("https://example.com/a")
        await vi.runAllTimersAsync()

        linkPreviewStore.applyRealtime([preview({ status: "Fetched", title: "Landed" })])

        expect(linkPreviewStore.get("https://example.com/a?utm_source=x")?.title).toBe("Landed")
        expect(linkPreviewStore.get("https://example.com/a")?.title).toBe("Landed")
    })

    it("refetches null entries when a realtime event arrives", async () => {
        const client = makeClient()
        // First answer: the doc did not exist yet (message just sent).
        client.respondWith(() => ({ "https://example.com/new": null }))
        linkPreviewStore.setClient(client.forStore)

        linkPreviewStore.register("https://example.com/new")
        await vi.runAllTimersAsync()
        expect(linkPreviewStore.get("https://example.com/new")).toBeNull()

        // The pipeline finished and broadcast. The second fetch finds the row.
        client.respondWith(() => ({
            "https://example.com/new": preview({ url: "https://example.com/new", title: "Now here" }),
        }))
        linkPreviewStore.applyRealtime([preview({ url: "https://example.com/other" })])
        await vi.runAllTimersAsync()

        expect(client.post).toHaveBeenCalledTimes(2)
        expect(linkPreviewStore.get("https://example.com/new")?.title).toBe("Now here")
    })

    it("splits oversized batches at the server's cap", async () => {
        const client = makeClient()
        client.respondWith((urls) => Object.fromEntries(urls.map((url) => [url, null])))
        linkPreviewStore.setClient(client.forStore)

        for (let index = 0; index < 60; index++) {
            linkPreviewStore.register(`https://example.com/${index}`)
        }
        await vi.runAllTimersAsync()

        expect(client.post).toHaveBeenCalledTimes(2)
        const firstBatch = client.calls[0].params?.urls as string[]
        const secondBatch = client.calls[1].params?.urls as string[]
        expect(firstBatch).toHaveLength(50)
        expect(secondBatch).toHaveLength(10)
        // Every url got an answer — none silently dropped past the cap.
        expect(linkPreviewStore.get("https://example.com/59")).toBeNull()
    })

    it("forgets a failed batch so a later register can retry", async () => {
        const client = makeClient()
        client.post.mockRejectedValueOnce(new Error("offline"))
        linkPreviewStore.setClient(client.forStore)

        linkPreviewStore.register("https://example.com/a")
        await vi.runAllTimersAsync()
        expect(linkPreviewStore.get("https://example.com/a")).toBeUndefined()

        client.respondWith(() => ({ "https://example.com/a": preview() }))
        linkPreviewStore.register("https://example.com/a")
        await vi.runAllTimersAsync()
        expect(linkPreviewStore.get("https://example.com/a")?.title).toBe("Title")
    })

    it("seeded urls are known — register fires no fetch for them", async () => {
        const client = makeClient()
        linkPreviewStore.setClient(client.forStore)

        linkPreviewStore.seed({
            "https://example.com/a": preview(),
            "https://example.com/none": null,
        })

        // The whole point of the side-car: the window's urls need no round trip.
        linkPreviewStore.register("https://example.com/a")
        linkPreviewStore.register("https://example.com/none")
        await vi.runAllTimersAsync()

        expect(client.post).not.toHaveBeenCalled()
        expect(linkPreviewStore.get("https://example.com/a")?.title).toBe("Title")
        expect(linkPreviewStore.get("https://example.com/none")).toBeNull()
    })

    it("realtime patches reach seeded urls through the normalized index", () => {
        // Raw spelling differs from the normalized url the event arrives under.
        linkPreviewStore.seed({
            "https://EXAMPLE.com/a?utm_source=x": preview({ status: "Pending", title: "" }),
        })

        linkPreviewStore.applyRealtime([preview({ title: "Arrived" })])

        expect(linkPreviewStore.get("https://EXAMPLE.com/a?utm_source=x")?.title).toBe("Arrived")
    })

    it("a seeded null never downgrades existing data", () => {
        linkPreviewStore.seed({ "https://example.com/a": preview({ title: "Kept" }) })
        // A later window's snapshot may predate a realtime patch — null must not erase.
        linkPreviewStore.seed({ "https://example.com/a": null })

        expect(linkPreviewStore.get("https://example.com/a")?.title).toBe("Kept")
    })

    it("a seeded null re-registers when previews land, like a fetched null", async () => {
        const client = makeClient()
        client.respondWith(() => ({ "https://example.com/a": preview({ title: "Now here" }) }))
        linkPreviewStore.setClient(client.forStore)

        // Window loaded before the background fetch finished: side-car says "nothing yet".
        linkPreviewStore.seed({ "https://example.com/a": null })

        // The completion event arrives for a url this client had no mapping for —
        // nulls re-register and one batched refetch resolves them.
        linkPreviewStore.applyRealtime([preview({ url: "https://example.com/other" })])
        await vi.runAllTimersAsync()

        expect(linkPreviewStore.get("https://example.com/a")?.title).toBe("Now here")
    })
})
