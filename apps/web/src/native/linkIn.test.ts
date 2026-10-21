import { describe, expect, it } from "vitest"

import { linkAction, linkFromAppUrl, skipsLaunchEcho, withHandled } from "./linkIn"

const site = "https://a.com/raven/ws/general"

describe("linkFromAppUrl", () => {
    it("reads the site link a raven://open address carries", () => {
        expect(linkFromAppUrl(`raven://open?url=${encodeURIComponent(site)}`)).toBe(site)
    })
    it("takes the slash some browsers add before the query", () => {
        expect(linkFromAppUrl(`raven://open/?url=${encodeURIComponent(site)}`)).toBe(site)
    })
    it("takes the page Safari's Smart App Banner passes as is", () => {
        expect(linkFromAppUrl(site)).toBe(site)
    })
    it("ignores shares, other schemes and non-web links", () => {
        expect(linkFromAppUrl("raven://?title=a&url=b")).toBeNull()
        expect(linkFromAppUrl(`raven.thecommit.company://oauth?url=${encodeURIComponent(site)}`)).toBeNull()
        expect(linkFromAppUrl(`raven://open?url=${encodeURIComponent("javascript:alert(1)")}`)).toBeNull()
        expect(linkFromAppUrl("raven://open")).toBeNull()
    })
})

describe("withHandled", () => {
    it("keeps the launch link known however many links follow, so a reload never replays it", () => {
        let handled = withHandled([], "raven://open?url=launch")
        for (let i = 0; i < 50; i++) handled = withHandled(handled, `raven://open?url=${i}`)
        expect(handled).toContain("raven://open?url=launch")
    })
    it("records a link once", () => {
        expect(withHandled(withHandled([], "a"), "a")).toEqual(["a"])
    })
})

describe("linkAction", () => {
    const saved = ["https://a.com", "https://b.com"]
    it("stays on the open site for its own links", () => {
        expect(linkAction("https://a.com/raven/threads", "https://a.com", saved)).toBe("here")
    })
    it("switches to another saved site", () => {
        expect(linkAction("https://b.com/raven/threads", "https://a.com", saved)).toBe("switch")
    })
    it("adds a site that isn't saved, with or without a site open", () => {
        expect(linkAction("https://c.com/raven/threads", "https://a.com", saved)).toBe("add")
        expect(linkAction("https://c.com/raven/threads", null, [])).toBe("add")
    })
})

describe("skipsLaunchEcho", () => {
    it("skips the event repeating the launch link boot opened, once", () => {
        expect(skipsLaunchEcho("raven://open?url=a", "raven://open?url=a")).toBe(true)
        expect(skipsLaunchEcho("raven://open?url=a", null)).toBe(false)
    })
    it("lets other links through", () => {
        expect(skipsLaunchEcho("raven://open?url=b", "raven://open?url=a")).toBe(false)
    })
})
