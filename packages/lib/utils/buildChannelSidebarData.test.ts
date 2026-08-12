import dayjs from "dayjs"
import { describe, expect, it } from "vitest"
import { buildChannelSidebarData } from "./buildChannelSidebarData"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import type { RavenUser } from "@raven/types/Raven/RavenUser"

const channel = (name: string, last_message_timestamp?: string, overrides?: Partial<ChannelListItem>) =>
    ({
        name,
        channel_name: name,
        workspace: "ws",
        type: "Public",
        is_archived: 0,
        member_id: "m",
        last_message_timestamp,
        ...overrides,
    } as unknown as ChannelListItem)

const profile = (overrides: Partial<RavenUser>) => ({ ...overrides } as RavenUser)

describe("buildChannelSidebarData", () => {
    it("sorts channels inside a group by that group's own sort_by", () => {
        const result = buildChannelSidebarData(
            [channel("zebra", "2026-07-01 00:00:00.000000"), channel("apple", "2026-01-01 00:00:00.000000")],
            profile({
                channel_groups: [{ group_name: "Design", sort_by: "Alphabetical Order" }],
                grouped_channels: [
                    { channel_id: "zebra", channel_group: "Design" },
                    { channel_id: "apple", channel_group: "Design" },
                ],
                sort_channels_by: "Recent Activity",
            } as Partial<RavenUser>),
            "ws",
        )
        expect(result.groupedChannels[0][1].map((c) => c.channel_name)).toEqual(["apple", "zebra"])
    })

    it("falls back to the global preference when sort_by is blank", () => {
        const result = buildChannelSidebarData(
            [channel("zebra", "2026-07-01 00:00:00.000000"), channel("apple", "2026-01-01 00:00:00.000000")],
            profile({
                channel_groups: [{ group_name: "Design", sort_by: "" }],
                grouped_channels: [
                    { channel_id: "zebra", channel_group: "Design" },
                    { channel_id: "apple", channel_group: "Design" },
                ],
                sort_channels_by: "Alphabetical Order",
            } as Partial<RavenUser>),
            "ws",
        )
        expect(result.groupedChannels[0][1].map((c) => c.channel_name)).toEqual(["apple", "zebra"])
    })

    it("sorts Favorites by the global preference", () => {
        const result = buildChannelSidebarData(
            [channel("zebra"), channel("apple")],
            profile({
                pinned_channels: [{ channel_id: "zebra" }, { channel_id: "apple" }],
                sort_channels_by: "Alphabetical Order",
            } as Partial<RavenUser>),
            "ws",
        )
        expect(result.groupedChannels[0][0]).toBe("Favorites")
        expect(result.groupedChannels[0][1].map((c) => c.channel_name)).toEqual(["apple", "zebra"])
    })

    it("drops groups that have no visible channels", () => {
        const result = buildChannelSidebarData(
            [channel("apple")],
            profile({
                channel_groups: [{ group_name: "Design" }, { group_name: "Empty" }],
                grouped_channels: [{ channel_id: "apple", channel_group: "Design" }],
            } as Partial<RavenUser>),
            "ws",
        )
        expect(result.groupedChannels.map(([name]) => name)).toEqual(["Design"])
    })

    describe("sidebar filters", () => {
        const recent = dayjs().format("YYYY-MM-DD HH:mm:ss.SSS000")
        const stale = "2020-01-01 00:00:00.000000"

        // Filler to push a workspace past the 15-channel threshold (absolute
        // non-archived count) where the filter preferences start applying.
        const filler = Array.from({ length: 15 }, (_, i) => channel(`filler-${i}`, recent))

        const names = (result: ReturnType<typeof buildChannelSidebarData>) =>
            result.ungroupedChannels.map((c) => c.channel_name)

        it("hides a not-joined channel when the joined filter is on", () => {
            const result = buildChannelSidebarData(
                [...filler, channel("lonely", recent, { member_id: "" })],
                profile({ filter_joined_channels: 1 }),
                "ws",
            )
            expect(names(result)).not.toContain("lonely")
        })

        it("never hides an Open channel — membership is implicit", () => {
            const result = buildChannelSidebarData(
                [...filler, channel("townhall", stale, { member_id: "", type: "Open" })],
                profile({ filter_joined_channels: 1, filter_recent_activity: 1 }),
                "ws",
            )
            expect(names(result)).toContain("townhall")
        })

        it("never hides a channel the user grouped or pinned", () => {
            const result = buildChannelSidebarData(
                [...filler, channel("grouped", stale, { member_id: "" }), channel("pinned", stale, { member_id: "" })],
                profile({
                    filter_joined_channels: 1,
                    filter_recent_activity: 1,
                    channel_groups: [{ group_name: "Design" }],
                    grouped_channels: [{ channel_id: "grouped", channel_group: "Design" }],
                    pinned_channels: [{ channel_id: "pinned" }],
                } as Partial<RavenUser>),
                "ws",
            )
            const grouped = Object.fromEntries(result.groupedChannels)
            expect(grouped["Design"]?.map((c) => c.channel_name)).toContain("grouped")
            expect(grouped["Favorites"]?.map((c) => c.channel_name)).toContain("pinned")
        })

        it("skips the filters entirely in a workspace under 15 channels", () => {
            const result = buildChannelSidebarData(
                [channel("small", stale, { member_id: "" }), channel("other", recent)],
                profile({ filter_joined_channels: 1, filter_recent_activity: 1 }),
                "ws",
            )
            expect(names(result)).toContain("small")
        })

        it("counts every workspace channel toward the threshold, exemptions included", () => {
            // 20 channels total — over the threshold even though only 14 are
            // ones the filters could touch (6 are grouped), so the loose
            // not-joined channel is hidden.
            const grouped = Array.from({ length: 6 }, (_, i) => channel(`grouped-${i}`, recent))
            const result = buildChannelSidebarData(
                [...filler.slice(0, 13), channel("lonely", recent, { member_id: "" }), ...grouped],
                profile({
                    filter_joined_channels: 1,
                    channel_groups: [{ group_name: "Design" }],
                    grouped_channels: grouped.map((c) => ({ channel_id: c.name, channel_group: "Design" })),
                } as Partial<RavenUser>),
                "ws",
            )
            expect(names(result)).not.toContain("lonely")
        })
    })

    it("excludes channels from other workspaces and archived channels", () => {
        const other = { ...channel("other"), workspace: "elsewhere" } as ChannelListItem
        const archived = { ...channel("archived"), is_archived: 1 } as unknown as ChannelListItem
        const result = buildChannelSidebarData([channel("apple"), other, archived], profile({}), "ws")
        expect(result.ungroupedChannels.map((c) => c.channel_name)).toEqual(["apple"])
    })
})
