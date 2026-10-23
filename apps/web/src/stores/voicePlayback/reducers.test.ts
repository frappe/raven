import { describe, expect, it } from "vitest"
import { end, fail, forget, initialPlayback, nextSpeed, pause, play, seek, selectNote, setSpeed, tick } from "./reducers"

describe("voice playback reducers", () => {
    it("plays a note", () => {
        const state = play(initialPlayback(), "a", 0)
        expect(selectNote(state, "a")).toMatchObject({ playing: true, position: 0, error: false })
    })

    it("play() on another id saves the previous position and plays only the new one", () => {
        const a = tick(play(initialPlayback(), "a", 0), 4)
        const b = play(a, "b", 4.5)
        expect(selectNote(b, "a")).toMatchObject({ playing: false, position: 4.5 })
        expect(selectNote(b, "b").playing).toBe(true)
    })

    it("pause keeps the position for resume", () => {
        const state = pause(play(initialPlayback(), "a", 0), 3)
        expect(selectNote(state, "a")).toMatchObject({ playing: false, position: 3 })
    })

    it("pause without an active note is a no-op", () => {
        const state = initialPlayback()
        expect(pause(state, 1)).toBe(state)
    })

    it("tick returns the same state when the position is unchanged", () => {
        const state = tick(play(initialPlayback(), "a", 0), 2)
        expect(tick(state, 2)).toBe(state)
    })

    it("end clears the position so the next play starts over", () => {
        const state = end(tick(play(initialPlayback(), "a", 0), 9))
        expect(selectNote(state, "a")).toMatchObject({ playing: false, position: 0 })
    })

    it("fail marks the note and a later play clears it", () => {
        const failed = fail(play(initialPlayback(), "a", 0))
        expect(selectNote(failed, "a")).toMatchObject({ playing: false, error: true })
        expect(selectNote(play(failed, "a", 0), "a").error).toBe(false)
    })

    it("seek sets a position on any note, never below zero", () => {
        expect(selectNote(seek(initialPlayback(), "z", 12), "z").position).toBe(12)
        expect(selectNote(seek(initialPlayback(), "z", -3), "z").position).toBe(0)
    })

    it("cycles speed 1 → 1.5 → 2 → 1", () => {
        expect(nextSpeed(1)).toBe(1.5)
        expect(nextSpeed(1.5)).toBe(2)
        expect(nextSpeed(2)).toBe(1)
    })

    it("setSpeed to the same value is a no-op", () => {
        const state = initialPlayback(1.5)
        expect(setSpeed(state, 1.5)).toBe(state)
    })

    it("forget drops the notes' positions and stops the active one", () => {
        const state = seek(tick(play(initialPlayback(), "a", 0), 4), "b", 9)
        const next = forget(state, ["a", "b"])
        expect(selectNote(next, "a")).toMatchObject({ playing: false, position: 0 })
        expect(selectNote(next, "b").position).toBe(0)
        expect(next.activeId).toBeNull()
    })

    it("forget leaves other notes alone", () => {
        const state = seek(play(initialPlayback(), "a", 0), "c", 3)
        const next = forget(state, ["c"])
        expect(selectNote(next, "a").playing).toBe(true)
        expect(selectNote(next, "c").position).toBe(0)
    })
})
