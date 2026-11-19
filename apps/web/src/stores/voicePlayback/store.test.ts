import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VoicePlaybackStore } from "./store"

/** Minimal HTMLAudioElement: events, the load algorithm on a src swap, and a controllable play(). */
class FakeAudio extends EventTarget {
    static instances: FakeAudio[] = []
    /** Replaces the next play() call (e.g. to reject it). */
    static nextPlay: (() => Promise<void>) | null = null
    /** play() stays pending (still loading) instead of starting at once. */
    static deferPlay = false
    private pendingPlay: { reject: (error: Error) => void } | null = null
    currentTime = 0
    paused = true
    ended = false
    preload = ""
    playbackRate = 1
    defaultPlaybackRate = 1
    private source = ""

    constructor() {
        super()
        FakeAudio.instances.push(this)
    }

    get src() {
        return this.source
    }

    set src(value: string) {
        // The load algorithm: no `pause` event, position back to 0, a pending play()
        // rejects, and a stale `timeupdate` is queued.
        if (this.source) {
            this.paused = true
            this.currentTime = 0
            this.pendingPlay?.reject(Object.assign(new Error("interrupted"), { name: "AbortError" }))
            this.pendingPlay = null
            queueMicrotask(() => this.dispatchEvent(new Event("timeupdate")))
        }
        this.source = value
    }

    play() {
        const custom = FakeAudio.nextPlay
        FakeAudio.nextPlay = null
        if (custom) return custom()
        this.paused = false
        this.dispatchEvent(new Event("play"))
        if (FakeAudio.deferPlay) return new Promise<void>((_resolve, reject) => { this.pendingPlay = { reject } })
        this.dispatchEvent(new Event("playing"))
        return Promise.resolve()
    }

    pause() {
        if (this.paused) return
        this.paused = true
        this.dispatchEvent(new Event("pause"))
    }
}

const audio = () => FakeAudio.instances[FakeAudio.instances.length - 1]

describe("VoicePlaybackStore", () => {
    const original = globalThis.Audio

    beforeEach(() => {
        FakeAudio.instances = []
        FakeAudio.nextPlay = null
        FakeAudio.deferPlay = false
        globalThis.Audio = FakeAudio as unknown as typeof Audio
        vi.useFakeTimers()
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16))
        vi.stubGlobal("cancelAnimationFrame", (handle: number) => clearTimeout(handle))
    })

    afterEach(() => {
        globalThis.Audio = original
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it("switching notes doesn't pause the new one", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        store.toggle("b", "/b.m4a")
        expect(store.getSnapshot("b").playing).toBe(true)
        expect(store.getSnapshot("a").playing).toBe(false)
    })

    it("an aborted play of a replaced note doesn't mark the new one failed", async () => {
        const store = new VoicePlaybackStore()
        FakeAudio.nextPlay = () => Promise.reject(Object.assign(new Error("interrupted"), { name: "AbortError" }))
        store.toggle("a", "/a.m4a")
        store.toggle("b", "/b.m4a")
        await Promise.resolve()
        expect(store.getSnapshot("b").error).toBe(false)
    })

    it("a seek right after starting a note survives its metadata load", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        store.seek("a", 5)
        audio().dispatchEvent(new Event("loadedmetadata"))
        expect(audio().currentTime).toBe(5)
    })

    it("a play from outside (media keys) marks the note playing again", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        audio().dispatchEvent(new Event("loadedmetadata"))
        audio().pause()
        expect(store.getSnapshot("a").playing).toBe(false)
        audio().play()
        expect(store.getSnapshot("a").playing).toBe(true)
    })

    it("stopAll (navigation) stops the playing note and forgets every position", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        store.seek("b", 8)
        store.stopAll()
        expect(store.getSnapshot("a")).toMatchObject({ playing: false, position: 0 })
        expect(store.getSnapshot("b").position).toBe(0)
        expect(audio().paused).toBe(true)
    })

    it("switching back to a note resumes where it was left", async () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        audio().currentTime = 40
        store.toggle("b", "/b.m4a")
        store.toggle("a", "/a.m4a")
        await Promise.resolve()
        audio().dispatchEvent(new Event("loadedmetadata"))
        expect(audio().currentTime).toBe(40)
        expect(store.getSnapshot("a").position).toBe(40)
    })

    it("pausing a note that is still loading stops it", () => {
        const store = new VoicePlaybackStore()
        FakeAudio.deferPlay = true
        store.toggle("b", "/b.m4a")
        store.toggle("b", "/b.m4a")
        expect(store.getSnapshot("b").playing).toBe(false)
    })

    it("a note that finished isn't shown as played after switching", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        audio().currentTime = 12
        audio().ended = true
        audio().dispatchEvent(new Event("ended"))
        store.toggle("b", "/b.m4a")
        expect(store.getSnapshot("a").position).toBe(0)
    })

    it("the playing note's position follows playback every frame", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        audio().dispatchEvent(new Event("loadedmetadata"))
        audio().currentTime = 3.2
        vi.advanceTimersByTime(20)
        expect(store.getSnapshot("a").position).toBe(3.2)
    })

    it("frames during a switch don't overwrite the resume position", async () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        audio().currentTime = 40
        vi.advanceTimersByTime(20)
        store.toggle("b", "/b.m4a")
        vi.advanceTimersByTime(20)
        store.toggle("a", "/a.m4a")
        vi.advanceTimersByTime(20)
        await Promise.resolve()
        audio().dispatchEvent(new Event("loadedmetadata"))
        expect(audio().currentTime).toBe(40)
    })

    it("a stray pause event while the new note loads doesn't stop it", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        audio().dispatchEvent(new Event("pause"))
        expect(store.getSnapshot("a").playing).toBe(true)
    })

    it("tapping a note the element already paused un-sticks it", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a")
        audio().dispatchEvent(new Event("loadedmetadata"))
        audio().paused = true
        store.toggle("a", "/a.m4a")
        expect(store.getSnapshot("a").playing).toBe(false)
    })

    it("stop drops one note: pauses it if playing, forgets its position, leaves others", () => {
        const store = new VoicePlaybackStore()
        store.seek("other", 5)
        store.toggle("draft", "blob:draft")
        store.stop("draft")
        expect(store.getSnapshot("draft")).toMatchObject({ playing: false, position: 0 })
        expect(audio().paused).toBe(true)
        expect(store.getSnapshot("other").position).toBe(5)
    })
})
