import { afterEach, describe, expect, it, vi } from "vitest"
import { markOnboardedInBootCache } from "./setup"

const storage = (initial: Record<string, string>) => {
    const data = { ...initial }
    return { data, getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => { data[key] = value } }
}

afterEach(() => vi.unstubAllGlobals())

describe("markOnboardedInBootCache", () => {
    it("marks the cached boot onboarded, so an offline launch doesn't ask again", () => {
        const store = storage({ "raven-boot-cache": JSON.stringify({ raven_onboarded: 0, user: { name: "a" } }) })
        vi.stubGlobal("localStorage", store)
        markOnboardedInBootCache()
        expect(JSON.parse(store.data["raven-boot-cache"])).toEqual({ raven_onboarded: 1, user: { name: "a" } })
    })

    it("leaves storage alone when nothing is cached", () => {
        const store = storage({})
        vi.stubGlobal("localStorage", store)
        markOnboardedInBootCache()
        expect(store.data).toEqual({})
    })

    it("survives a corrupt cache", () => {
        vi.stubGlobal("localStorage", storage({ "raven-boot-cache": "{not json" }))
        expect(() => markOnboardedInBootCache()).not.toThrow()
    })
})
