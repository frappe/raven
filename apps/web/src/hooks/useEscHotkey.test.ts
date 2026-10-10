import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    get: vi.fn(() => null),
    hotkeys: vi.fn(),
    querySelector: vi.fn(),
    shadowQuerySelector: vi.fn(),
}))
vi.mock("jotai", () => ({ getDefaultStore: () => ({ get: mocks.get }) }))
vi.mock("react-hotkeys-hook", () => ({ useHotkeys: mocks.hotkeys }))
vi.mock("@utils/attachmentPreview", () => ({ attachmentPreviewAtom: "preview" }))
vi.mock("@utils/channelAtoms", () => ({ messageDialogAtom: "dialog" }))

let hooks: typeof import("./useEscHotkey")
let target: EventTarget
beforeAll(async () => {
    target = new EventTarget()
    vi.stubGlobal("document", {
        addEventListener: target.addEventListener.bind(target),
        querySelector: mocks.querySelector,
        activeElement: { shadowRoot: { querySelector: mocks.shadowQuerySelector } },
    })
    hooks = await import("./useEscHotkey")
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => vi.clearAllMocks())

const pressEscape = () => {
    const event = new Event("keydown")
    Object.defineProperty(event, "key", { value: "Escape" })
    target.dispatchEvent(event)
}

describe("Escape while Cloud Settings is open", () => {
    it("leaves Escape to an overlay inside the focused shadow root", () => {
        mocks.querySelector.mockReturnValue(null)
        mocks.shadowQuerySelector.mockReturnValue({})
        pressEscape()
        expect(hooks.escOwnedByOverlay()).toBe(true)
    })

    it("allows a page hotkey when neither the page nor shadow root has an overlay", () => {
        mocks.querySelector.mockReturnValue(null)
        mocks.shadowQuerySelector.mockReturnValue(null)
        pressEscape()
        expect(hooks.escOwnedByOverlay()).toBe(false)
    })

    it("ignores an overlay before preventing default and keeps a disabled hotkey disabled", () => {
        mocks.querySelector.mockReturnValue({})
        pressEscape()
        hooks.useEscHotkey(vi.fn(), { enabled: false, preventDefault: true })
        const options = mocks.hotkeys.mock.calls[0][2]
        expect(options.enabled).toBe(false)
        expect(options.ignoreEventWhen()).toBe(true)
    })
})
