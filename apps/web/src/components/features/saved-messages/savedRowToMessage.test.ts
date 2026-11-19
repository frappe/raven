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

    it("keeps a location's payload and snapshot", () => {
        const message = savedRowToMessage({
            ...row,
            message_type: "Location",
            text: "<p>link</p>",
            file: "/private/files/location.webp",
            json: '{"latitude":1,"longitude":2}',
        })
        expect(message).toMatchObject({
            message_type: "Location",
            text: "<p>link</p>",
            file: "/private/files/location.webp",
            json: '{"latitude":1,"longitude":2}',
        })
    })

    it("omits the file for a location without a snapshot", () => {
        const message = savedRowToMessage({ ...row, message_type: "Location", file: undefined, json: '{"latitude":1,"longitude":2}' })
        expect("file" in message).toBe(false)
    })
})
