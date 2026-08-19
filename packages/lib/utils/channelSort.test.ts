import { describe, expect, it } from "vitest"
import { sortChannels } from "./channelSort"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"

const channel = (channel_name: string, last_message_timestamp?: string) =>
    ({ name: channel_name, channel_name, last_message_timestamp } as ChannelListItem)

describe("sortChannels", () => {
    it("sorts alphabetically by channel_name", () => {
        const result = sortChannels([channel("zebra"), channel("apple")], "Alphabetical Order")
        expect(result.map((c) => c.channel_name)).toEqual(["apple", "zebra"])
    })

    it("sorts most-recent-first for Recent Activity", () => {
        const result = sortChannels(
            [channel("old", "2026-01-01 00:00:00.000000"), channel("new", "2026-07-01 00:00:00.000000")],
            "Recent Activity",
        )
        expect(result.map((c) => c.channel_name)).toEqual(["new", "old"])
    })

    it("defaults to Recent Activity when the mode is empty", () => {
        const result = sortChannels(
            [channel("old", "2026-01-01 00:00:00.000000"), channel("new", "2026-07-01 00:00:00.000000")],
            "",
        )
        expect(result.map((c) => c.channel_name)).toEqual(["new", "old"])
    })

    it("resolves the unimplemented Unreads First mode to Recent Activity", () => {
        const result = sortChannels(
            [channel("old", "2026-01-01 00:00:00.000000"), channel("new", "2026-07-01 00:00:00.000000")],
            "Unreads First",
        )
        expect(result.map((c) => c.channel_name)).toEqual(["new", "old"])
    })

    it("treats a missing timestamp as oldest", () => {
        const result = sortChannels([channel("none"), channel("dated", "2026-07-01 00:00:00.000000")])
        expect(result.map((c) => c.channel_name)).toEqual(["dated", "none"])
    })

    it("does not mutate its input", () => {
        const input = [channel("zebra"), channel("apple")]
        sortChannels(input, "Alphabetical Order")
        expect(input.map((c) => c.channel_name)).toEqual(["zebra", "apple"])
    })
})
