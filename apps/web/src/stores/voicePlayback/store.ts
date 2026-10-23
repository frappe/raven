import { end, fail, forget, initialPlayback, nextSpeed, pause, play, seek, selectNote, setSpeed, tick, type NotePlayback, type PlaybackState, type Speed, SPEEDS } from "./reducers"

type Listener = () => void

const SPEED_KEY = "raven-voice-speed"

const readSpeed = (): Speed => {
    try {
        const stored = Number(localStorage.getItem(SPEED_KEY))
        return (SPEEDS as readonly number[]).includes(stored) ? (stored as Speed) : 1
    } catch {
        return 1
    }
}

const writeSpeed = (speed: Speed) => {
    try {
        localStorage.setItem(SPEED_KEY, String(speed))
    } catch {
        // Private mode / blocked storage: the speed still applies for this session.
    }
}

/**
 * Voice note playback for the whole app: ONE audio element, so one note plays at a
 * time and playback survives its row scrolling out of the virtualized stream.
 * Notifies per message id; playback frames wake only the playing note.
 */
export class VoicePlaybackStore {
    private state: PlaybackState = initialPlayback(readSpeed())
    private audio: HTMLAudioElement | null = null
    private listeners = new Map<string, Set<Listener>>()
    private snapshots = new Map<string, NotePlayback>()
    // Follows the playing note every frame, so the waveform fills one bar at a time.
    private frame = 0
    // From a src swap to its resume seek the element reads 0 and may fire a stray `pause`;
    // neither frames nor that event may touch the new note's state.
    private loading = false
    /** Channel or thread of every note with state, so leaving one resets only its own notes. */
    private channelOf = new Map<string, string>()

    subscribe(id: string, listener: Listener): () => void {
        let set = this.listeners.get(id)
        if (!set) {
            set = new Set()
            this.listeners.set(id, set)
        }
        set.add(listener)
        return () => {
            set.delete(listener)
            if (set.size === 0) this.listeners.delete(id)
        }
    }

    getSnapshot(id: string): NotePlayback {
        let snapshot = this.snapshots.get(id)
        if (!snapshot) {
            snapshot = selectNote(this.state, id)
            this.snapshots.set(id, snapshot)
        }
        return snapshot
    }

    toggle(id: string, src: string, channelId: string) {
        const audio = this.element()
        if (this.state.activeId === id && this.state.playing) {
            // No `pause` event will record this (ignored mid-load, or the element is already
            // paused, e.g. by the OS during a load), so record it here.
            if (this.loading || audio.paused) {
                const position = this.loading ? (this.state.positions.get(id) ?? 0) : audio.currentTime
                this.update(pause(this.state, position), [id])
            }
            audio.pause()
            return
        }
        const previous = this.state.activeId
        this.channelOf.set(id, channelId)
        // A failed note reloads its source on retry.
        const reload = previous !== id || !audio.src || this.state.errors.has(id)
        this.update(play(this.state, id, audio.currentTime), [previous, id])
        if (reload) {
            this.loading = true
            audio.src = src
            // Read at load time: a seek made while loading must win over the old position.
            audio.addEventListener("loadedmetadata", () => {
                audio.currentTime = this.state.positions.get(id) ?? 0
                this.loading = false
            }, { once: true })
        }
        audio.defaultPlaybackRate = this.state.speed
        audio.playbackRate = this.state.speed
        audio.play().catch((error: unknown) => {
            // A newer toggle replaced this load; that note owns the element now.
            if ((error as { name?: string })?.name === "AbortError" || this.state.activeId !== id) return
            this.update(fail(this.state), [id])
        })
    }

    seek(id: string, seconds: number, channelId: string) {
        this.channelOf.set(id, channelId)
        if (this.state.activeId === id && this.audio) this.audio.currentTime = Math.max(0, seconds)
        this.update(seek(this.state, id, seconds), [id])
    }

    /** Keyboard seek: relative to where the note is, kept within [0, duration]. */
    seekBy(id: string, deltaSeconds: number, duration: number, channelId: string) {
        const from = this.state.positions.get(id) ?? 0
        this.seek(id, Math.min(duration, Math.max(0, from + deltaSeconds)), channelId)
    }

    cycleSpeed() {
        const speed = nextSpeed(this.state.speed)
        writeSpeed(speed)
        if (this.audio) {
            this.audio.defaultPlaybackRate = speed
            this.audio.playbackRate = speed
        }
        this.update(setSpeed(this.state, speed), "all")
    }

    pause() {
        this.audio?.pause()
    }

    /** Leaving a list of notes from many channels (saved, threads): everything stops and starts over. */
    stopAll() {
        const ids = new Set([...this.channelOf.keys(), ...this.state.positions.keys()])
        if (this.state.activeId) ids.add(this.state.activeId)
        this.channelOf.clear()
        this.audio?.pause()
        if (ids.size > 0) this.update(forget(this.state, [...ids]), [...ids])
    }

    /** Leaving a channel or thread: its notes stop and start over next time. */
    leaveChannel(channelId: string) {
        const ids = [...this.channelOf].filter(([, channel]) => channel === channelId).map(([id]) => id)
        if (ids.length === 0) return
        ids.forEach((id) => this.channelOf.delete(id))
        if (this.state.activeId && ids.includes(this.state.activeId)) this.audio?.pause()
        this.update(forget(this.state, ids), ids)
    }

    private element(): HTMLAudioElement {
        if (this.audio) return this.audio
        const audio = new Audio()
        audio.preload = "auto"
        audio.addEventListener("playing", () => {
            if (!this.frame) this.frame = requestAnimationFrame(this.follow)
        })
        // Media keys / OS controls can resume the element without a toggle.
        audio.addEventListener("play", () => {
            if (this.state.activeId && !this.state.playing) this.update(play(this.state, this.state.activeId, audio.currentTime), [this.state.activeId])
        })
        audio.addEventListener("pause", () => {
            if (this.loading || audio.ended) return
            this.update(pause(this.state, audio.currentTime), [this.state.activeId])
        })
        audio.addEventListener("ended", () => this.update(end(this.state), [this.state.activeId]))
        audio.addEventListener("error", () => {
            if (!audio.src) return
            this.update(fail(this.state), [this.state.activeId])
        })
        this.audio = audio
        return audio
    }

    private follow = () => {
        const audio = this.audio
        if (!audio || audio.paused || audio.ended) {
            this.frame = 0
            return
        }
        if (!this.loading) this.update(tick(this.state, audio.currentTime), [this.state.activeId])
        this.frame = requestAnimationFrame(this.follow)
    }

    private update(next: PlaybackState, ids: (string | null)[] | "all") {
        if (next === this.state) return
        this.state = next
        if (ids === "all") {
            this.snapshots.clear()
            this.listeners.forEach((set) => set.forEach((listener) => listener()))
            return
        }
        for (const id of new Set(ids)) {
            if (!id) continue
            this.snapshots.delete(id)
            this.listeners.get(id)?.forEach((listener) => listener())
        }
    }
}

export const voicePlaybackStore = new VoicePlaybackStore()
