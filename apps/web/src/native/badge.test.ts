import { describe, expect, it, vi } from "vitest"

const plugin = {
    checkPermissions: vi.fn(async () => ({ display: "prompt" })),
    set: vi.fn(async () => { }),
    clear: vi.fn(async () => { }),
}
vi.mock("@capawesome/capacitor-badge", () => ({ Badge: plugin }))

const { setNativeBadge, reapplyNativeBadge } = await import("./badge")

describe("native badge", () => {
    it("holds the count until notifications are allowed, then shows it", async () => {
        await setNativeBadge(4)
        expect(plugin.set).not.toHaveBeenCalled()

        plugin.checkPermissions.mockResolvedValue({ display: "granted" })
        await reapplyNativeBadge()
        expect(plugin.set).toHaveBeenCalledWith({ count: 4 })

        await setNativeBadge(0)
        expect(plugin.clear).toHaveBeenCalledTimes(1)
    })

    it("drops a write that a newer count overtook", async () => {
        plugin.set.mockClear()
        plugin.clear.mockClear()
        // Both writes wait on the plugin import; the 4 was asked for first but is now outdated.
        const old = setNativeBadge(4)
        await setNativeBadge(0)
        await old
        expect(plugin.clear).toHaveBeenCalledTimes(1)
        expect(plugin.set).not.toHaveBeenCalled()
    })
})
