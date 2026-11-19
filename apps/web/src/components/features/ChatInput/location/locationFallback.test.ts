import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { senderMapsUrl } from "@lib/location"
import { escapeHtml } from "@utils/htmlUtils"
import { locationFallbackHtml } from "./useLocationShare"

// _() reads window.frappe; node has no window.
beforeEach(() => vi.stubGlobal("window", {}))
afterEach(() => vi.unstubAllGlobals())

const location = { latitude: 1, longitude: 2 }

describe("locationFallbackHtml", () => {
    it("builds an escaped link paragraph with the sender's maps link", () => {
        const html = locationFallbackHtml(location)
        expect(html).toMatch(/^<p><a href="https:\/\/[^"]+">[^<]+<\/a><\/p>$/)
    })

    it("escapes the URL in both the href and the link text", () => {
        const escaped = escapeHtml(senderMapsUrl(location))
        const html = locationFallbackHtml(location)

        expect(escaped).toContain("&amp;")
        expect(html).toContain(`href="${escaped}"`)
        expect(html).toContain(`>${escaped}</a>`)
    })
})
