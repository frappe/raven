import { describe, expect, it, vi } from "vitest"
import { channelMembersStore } from "./store"

const admin = { is_admin: 1 as const, channel_member_name: "m1" }
const member = { is_admin: 0 as const, channel_member_name: "m1" }

describe("channelMembersStore.setMembers", () => {
    it("notifies only when the members change", () => {
        const listener = vi.fn()
        const unsubscribe = channelMembersStore.subscribe("thread-a", listener)
        channelMembersStore.setMembers("thread-a", { a: admin })
        const first = channelMembersStore.getEntry("thread-a")
        channelMembersStore.setMembers("thread-a", { a: admin })
        expect(listener).toHaveBeenCalledTimes(1)
        expect(channelMembersStore.getEntry("thread-a")).toBe(first)

        channelMembersStore.setMembers("thread-a", { a: member })
        channelMembersStore.setMembers("thread-a", { a: member, b: { is_admin: 0, channel_member_name: "m2" } })
        expect(listener).toHaveBeenCalledTimes(3)
        unsubscribe()
    })

    it("keeps the members object when a refetch returns the same members", () => {
        channelMembersStore.setMembers("thread-b", { a: member })
        const members = channelMembersStore.getEntry("thread-b").members
        channelMembersStore.setStatus("thread-b", "loading")
        channelMembersStore.setMembers("thread-b", { a: { ...member } })
        expect(channelMembersStore.getEntry("thread-b")).toMatchObject({ status: "loaded" })
        expect(channelMembersStore.getEntry("thread-b").members).toBe(members)
    })
})
