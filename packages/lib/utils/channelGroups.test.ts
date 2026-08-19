import { describe, expect, it } from "vitest"
import {
    assignChannelToGroup,
    isDuplicateGroupName,
    removeGroupFromChannels,
    renameGroupInChannels,
    reorderGroups,
} from "./channelGroups"

const g = (group_name: string, idx?: number) => ({ group_name, idx })

describe("isDuplicateGroupName", () => {
    it("matches case-insensitively and ignoring surrounding space", () => {
        expect(isDuplicateGroupName([g("Design")], "  design  ")).toBe(true)
    })

    it("allows a name that is not taken", () => {
        expect(isDuplicateGroupName([g("Design")], "Eng")).toBe(false)
    })

    it("ignores the row being renamed so a group can keep its own name", () => {
        expect(isDuplicateGroupName([g("Design"), g("Eng")], "Design", 0)).toBe(false)
    })
})

describe("reorderGroups", () => {
    it("moves a group to the target position and renumbers idx from 1", () => {
        const result = reorderGroups([g("A", 1), g("B", 2), g("C", 3)], "C", "A")
        expect(result.map((x) => [x.group_name, x.idx])).toEqual([
            ["C", 1],
            ["A", 2],
            ["B", 3],
        ])
    })

    it("preserves the position of groups that were not dragged", () => {
        // reorderGroups resolves names against the FULL array it is given. Whether the CALLER passes the full form-state array (rather than the preview's filtered, non-empty subset) is the actual invariant — enforced in useChannelGroups, not testable here.
        const result = reorderGroups([g("A", 1), g("Empty", 2), g("C", 3)], "C", "A")
        expect(result.map((x) => x.group_name)).toEqual(["C", "A", "Empty"])
    })

    it("returns the same reference for a no-op drag", () => {
        const input = [g("A", 1), g("B", 2)]
        expect(reorderGroups(input, "A", "A")).toBe(input)
    })

    it("returns the same reference when a name is unknown", () => {
        const input = [g("A", 1)]
        expect(reorderGroups(input, "A", "Nope")).toBe(input)
    })
})

describe("renameGroupInChannels", () => {
    it("rewrites every row that referenced the old name", () => {
        const rows = [
            { channel_id: "c1", channel_group: "Design" },
            { channel_id: "c2", channel_group: "Eng" },
            { channel_id: "c3", channel_group: "Design" },
        ]
        expect(renameGroupInChannels(rows, "Design", "Brand").map((r) => r.channel_group)).toEqual([
            "Brand",
            "Eng",
            "Brand",
        ])
    })
})

describe("removeGroupFromChannels", () => {
    it("drops rows for the deleted group and leaves the rest", () => {
        const rows = [
            { channel_id: "c1", channel_group: "Design" },
            { channel_id: "c2", channel_group: "Eng" },
        ]
        expect(removeGroupFromChannels(rows, "Design")).toEqual([{ channel_id: "c2", channel_group: "Eng" }])
    })
})

describe("assignChannelToGroup", () => {
    it("pins a channel and clears any group assignment", () => {
        const result = assignChannelToGroup([{ channel_id: "c1", channel_group: "Design" }], [], "c1", "Favorites")
        expect(result.grouped).toEqual([])
        expect(result.pinned).toEqual([{ channel_id: "c1" }])
    })

    it("groups a channel and clears any pin", () => {
        const result = assignChannelToGroup([], [{ channel_id: "c1" }], "c1", "Design")
        expect(result.grouped).toEqual([{ channel_id: "c1", channel_group: "Design" }])
        expect(result.pinned).toEqual([])
    })

    it("moves a channel between groups without duplicating it", () => {
        const result = assignChannelToGroup([{ channel_id: "c1", channel_group: "Design" }], [], "c1", "Eng")
        expect(result.grouped).toEqual([{ channel_id: "c1", channel_group: "Eng" }])
    })

    it("ungroups on a null target", () => {
        const result = assignChannelToGroup([{ channel_id: "c1", channel_group: "Design" }], [{ channel_id: "c1" }], "c1", null)
        expect(result.grouped).toEqual([])
        expect(result.pinned).toEqual([])
    })

    it("groups a channel that was previously unassigned", () => {
        const result = assignChannelToGroup([], [], "c1", "Design")
        expect(result.grouped).toEqual([{ channel_id: "c1", channel_group: "Design" }])
        expect(result.pinned).toEqual([])
    })

    it("pins a channel that was previously unassigned", () => {
        const result = assignChannelToGroup([], [], "c1", "Favorites")
        expect(result.grouped).toEqual([])
        expect(result.pinned).toEqual([{ channel_id: "c1" }])
    })
})
