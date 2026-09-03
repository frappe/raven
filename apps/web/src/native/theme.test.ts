import { beforeEach, describe, expect, it, vi } from "vitest"

const set = vi.fn(async (_o: unknown) => { })
vi.mock("@capacitor/preferences", () => ({ Preferences: { set: (o: unknown) => set(o) } }))
let native = true
vi.mock("./platform", () => ({ isNative: () => native }))

import { syncNativeTheme } from "./theme"

describe("syncNativeTheme", () => {
    beforeEach(() => { set.mockClear() })

    it("writes the raw preference on native", async () => {
        native = true
        syncNativeTheme("dark")
        await vi.waitFor(() => expect(set).toHaveBeenCalledWith({ key: "appTheme", value: "dark" }))
    })

    it("does nothing on the web", async () => {
        native = false
        syncNativeTheme("dark")
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(set).not.toHaveBeenCalled()
    })
})
