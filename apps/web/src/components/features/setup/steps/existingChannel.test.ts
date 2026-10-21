import { describe, expect, it } from "vitest"
import { findExistingChannel } from "./existingChannel"

const channel = (name: string, channel_name: string, workspace: string, is_archived: 0 | 1 = 0) => ({ name, channel_name, workspace, is_archived })

describe("findExistingChannel", () => {
    it("finds the workspace's channel with that name", () => {
        const channels = [channel("other-general", "general", "Other"), channel("acme-general", "general", "Acme")]
        expect(findExistingChannel(channels, "Acme", "general")?.name).toBe("acme-general")
    })

    it("matches the name regardless of case, as the server's duplicate check does", () => {
        expect(findExistingChannel([channel("acme-general", "General", "Acme")], "Acme", "general")?.name).toBe("acme-general")
    })

    it("skips an archived one", () => {
        expect(findExistingChannel([channel("acme-general", "general", "Acme", 1)], "Acme", "general")).toBeUndefined()
    })

    it("finds nothing when the workspace has no such channel", () => {
        expect(findExistingChannel([channel("acme-random", "random", "Acme")], "Acme", "general")).toBeUndefined()
    })
})
