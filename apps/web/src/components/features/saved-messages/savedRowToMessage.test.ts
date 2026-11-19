import { describe, expect, it } from "vitest"
import { savedRowToMessage, type SavedMessageRow } from "./savedRowToMessage"

const row: SavedMessageRow = {
    name: "m1",
    owner: "a@x.com",
    creation: "2026-10-23 10:00:00.000000",
    is_thread: 0,
    channel_id: "ch",
    message_type: "Voice",
    file: "/private/files/v.m4a",
    json: '{"duration":7,"waveform":[1]}',
}

describe("savedRowToMessage", () => {
    it("keeps a voice note's file and payload", () => {
        expect(savedRowToMessage(row)).toMatchObject({ message_type: "Voice", file: "/private/files/v.m4a", json: '{"duration":7,"waveform":[1]}' })
    })
})
