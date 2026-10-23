import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { VoicePlaybackStore } from "./store"

/** Minimal HTMLAudioElement: events, a src swap that pauses, and a controllable play(). */
class FakeAudio extends EventTarget {
    static instances: FakeAudio[] = []
    /** Replaces the next play() call (e.g. to reject it). */
    static nextPlay: (() => Promise<void>) | null = null
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
        // A real element pauses (and fires `pause`) when its source is replaced mid-play.
        if (!this.paused) this.pause()
        this.source = value
    }

    play() {
        const custom = FakeAudio.nextPlay
        FakeAudio.nextPlay = null
        if (custom) return custom()
        this.paused = false
        this.dispatchEvent(new Event("play"))
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
        globalThis.Audio = FakeAudio as unknown as typeof Audio
    })

    afterEach(() => {
        globalThis.Audio = original
    })

    it("switching notes doesn't pause the new one", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a", "ch")
        store.toggle("b", "/b.m4a", "ch")
        expect(store.getSnapshot("b").playing).toBe(true)
        expect(store.getSnapshot("a").playing).toBe(false)
    })

    it("an aborted play of a replaced note doesn't mark the new one failed", async () => {
        const store = new VoicePlaybackStore()
        FakeAudio.nextPlay = () => Promise.reject(Object.assign(new Error("interrupted"), { name: "AbortError" }))
        store.toggle("a", "/a.m4a", "ch")
        store.toggle("b", "/b.m4a", "ch")
        await Promise.resolve()
        expect(store.getSnapshot("b").error).toBe(false)
    })

    it("a seek right after starting a note survives its metadata load", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a", "ch")
        store.seek("a", 5, "ch")
        audio().dispatchEvent(new Event("loadedmetadata"))
        expect(audio().currentTime).toBe(5)
    })

    it("a play from outside (media keys) marks the note playing again", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a", "ch")
        audio().pause()
        expect(store.getSnapshot("a").playing).toBe(false)
        audio().play()
        expect(store.getSnapshot("a").playing).toBe(true)
    })

    it("leaving a channel stops its notes and forgets their positions", () => {
        const store = new VoicePlaybackStore()
        store.toggle("a", "/a.m4a", "thread-1")
        store.seek("b", 8, "thread-1")
        store.leaveChannel("channel-1")
        expect(store.getSnapshot("a").playing).toBe(true)
        store.leaveChannel("thread-1")
        expect(store.getSnapshot("a")).toMatchObject({ playing: false, position: 0 })
        expect(store.getSnapshot("b").position).toBe(0)
        expect(audio().paused).toBe(true)
    })
})
