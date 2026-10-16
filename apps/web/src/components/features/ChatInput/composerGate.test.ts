import { describe, expect, it } from "vitest"
import { resolveComposerGateState } from "./composerGate"

const dm = {
    channelsLoaded: true,
    isDM: true,
    membersLoading: false,
    isArchived: false,
    isOpen: false,
    isMember: true,
    peerDisabled: false,
}

describe("composer gate for direct messages", () => {
    it("blocks the composer when the peer is a disabled user", () => {
        expect(resolveComposerGateState({ ...dm, peerDisabled: true })).toBe("peer-disabled")
    })

    it("shows the composer when the peer is enabled", () => {
        expect(resolveComposerGateState(dm)).toBe("composer")
    })

    it("does not wait for members in a DM", () => {
        expect(resolveComposerGateState({ ...dm, membersLoading: true })).toBe("composer")
    })

    it("keeps archived ahead of a disabled peer", () => {
        expect(resolveComposerGateState({ ...dm, isArchived: true, peerDisabled: true })).toBe("archived")
    })
})
