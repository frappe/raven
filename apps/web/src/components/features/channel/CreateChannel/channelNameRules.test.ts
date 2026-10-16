import { describe, expect, it, vi } from "vitest"

vi.mock("@lib/translate", () => ({ default: (text: string) => text }))
vi.mock("@components/ui/input", () => ({ Input: () => null }))
vi.mock("@components/common/ChannelIcon/ChannelIcon", () => ({ ChannelIcon: () => null }))
import { channelNameRules } from "./ChannelNameInput"

const accepts = (name: string) => channelNameRules().pattern.value.test(name)

describe("channel name pattern", () => {
    it("accepts names in any script", () => {
        expect(accepts("маркетинг")).toBe(true)
        expect(accepts("отдел-продаж")).toBe(true)
        expect(accepts("営業")).toBe(true)
        expect(accepts("design-team-2")).toBe(true)
    })

    it("still rejects punctuation and a leading hyphen", () => {
        expect(accepts("-team")).toBe(false)
        expect(accepts("team!")).toBe(false)
        expect(accepts("team name")).toBe(false)
    })
})
