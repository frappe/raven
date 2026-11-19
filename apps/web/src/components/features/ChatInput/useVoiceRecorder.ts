import { useEffect, useRef, useState } from "react"
import { getAudioContext, suspendAudioContext } from "@lib/audioContext"
import {
    MAX_RECORDING_MS,
    MIN_RECORDING_MS,
    micErrorKind,
    pickRecordingFormat,
    voiceNoteFileName,
    type MicErrorKind,
    type RecordingFormat,
} from "./recordingFormat"
import { TICK_MS, createRecordingMeter } from "./recordingMeterStore"

export type RecordingEnd = "stopped" | "limit" | "interrupted"
export type VoiceRecorderStatus = "idle" | "requesting" | "recording"

type Session = {
    stream: MediaStream
    recorder: MediaRecorder
    source: MediaStreamAudioSourceNode
    analyser: AnalyserNode
    levelBuffer: Uint8Array<ArrayBuffer>
    format: RecordingFormat
    chunks: Blob[]
    startedAt: number
    timer: number
}

type Claim = { preempt: () => void }

// Enough to fill the widest composer; the bar shows only what fits.
const LEVEL_SAMPLES = 256

/** Only one composer may hold the mic, from the permission prompt on; a new start pre-empts it. */
let active: Claim | null = null

/** Loudest sample in the analyser window, 0–1: the measure the final waveform's bars use. */
const readPeak = (session: Session) => {
    session.analyser.getByteTimeDomainData(session.levelBuffer)
    let peak = 0
    for (const value of session.levelBuffer) {
        const magnitude = Math.abs(value - 128) / 128
        if (magnitude > peak) peak = magnitude
    }
    return peak
}

const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop())

const openSession = (stream: MediaStream, format: RecordingFormat): Session => {
    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType })
    const analyser = getAudioContext().createAnalyser()
    analyser.fftSize = 512
    const source = getAudioContext().createMediaStreamSource(stream)
    source.connect(analyser)
    return { stream, recorder, source, analyser, levelBuffer: new Uint8Array(analyser.fftSize), format, chunks: [], startedAt: Date.now(), timer: 0 }
}

const release = (session: Session) => {
    window.clearInterval(session.timer)
    session.source.disconnect()
    stopTracks(session.stream)
    suspendAudioContext()
}

/** Records while mounted: starts on mount, and unmounting discards the take and releases the mic. */
export const useVoiceRecorder = (onFinish: (file: File | null, reason: RecordingEnd) => void, onStartError: (error: MicErrorKind) => void) => {
    const [status, setStatus] = useState<VoiceRecorderStatus>("idle")
    const [meter] = useState(() => createRecordingMeter(LEVEL_SAMPLES))
    const sessionRef = useRef<Session | null>(null)
    const claimRef = useRef<Claim | null>(null)
    // Bumped on stop/cancel/unmount so a late getUserMedia resolve knows it's stale.
    const generationRef = useRef(0)
    const onFinishRef = useRef(onFinish)
    onFinishRef.current = onFinish
    const onStartErrorRef = useRef(onStartError)
    onStartErrorRef.current = onStartError

    const unclaim = () => {
        if (active === claimRef.current) active = null
        claimRef.current = null
    }

    const cancel = () => {
        generationRef.current++
        unclaim()
        const session = sessionRef.current
        sessionRef.current = null
        setStatus("idle")
        if (!session) return
        session.recorder.onstop = null
        if (session.recorder.state !== "inactive") session.recorder.stop()
        release(session)
    }

    const claim = () => {
        // Tell the owner too, so its bar closes.
        const own: Claim = {
            preempt: () => {
                cancel()
                onFinishRef.current(null, "interrupted")
            },
        }
        active?.preempt()
        active = own
        claimRef.current = own
    }

    const finish = (reason: RecordingEnd) => {
        const session = sessionRef.current
        if (!session) return
        sessionRef.current = null
        generationRef.current++
        unclaim()
        const length = Date.now() - session.startedAt
        // A cancel or unmount while the recorder flushes bumps this: the clip was thrown away.
        const generation = generationRef.current
        const done = () => {
            release(session)
            setStatus("idle")
            if (generation !== generationRef.current) return
            const type = session.recorder.mimeType || session.format.mimeType
            const blob = new Blob(session.chunks, { type })
            // Too short to be intended, or the recorder failed before capturing anything.
            if (length < MIN_RECORDING_MS || blob.size === 0) return onFinishRef.current(null, reason)
            onFinishRef.current(new File([blob], voiceNoteFileName(new Date(), session.format.extension), { type }), reason)
        }
        if (session.recorder.state === "inactive") return done()
        session.recorder.onstop = done
        session.recorder.stop()
    }

    const start = async (): Promise<MicErrorKind | null> => {
        const format = pickRecordingFormat((type) => MediaRecorder.isTypeSupported(type))
        if (!format) return "unknown"
        claim()
        const generation = ++generationRef.current
        setStatus("requesting")

        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (error) {
            if (generation !== generationRef.current) return null
            unclaim()
            setStatus("idle")
            return micErrorKind(error)
        }
        // Cancelled, pre-empted or unmounted while the permission prompt was open.
        if (generation !== generationRef.current) {
            stopTracks(stream)
            return null
        }

        let session: Session | undefined
        try {
            const own = openSession(stream, format)
            session = own
            own.recorder.ondataavailable = (event) => {
                if (event.data.size > 0) own.chunks.push(event.data)
                // Chunks arrive every second even in a hidden tab, where the tick timer is throttled.
                if (Date.now() - own.startedAt >= MAX_RECORDING_MS) finish("limit")
            }
            own.recorder.onerror = () => finish("interrupted")
            // Unplugged mic, OS revoke, or an iOS call interruption.
            stream.getAudioTracks()[0]?.addEventListener("ended", () => finish("interrupted"))
            own.recorder.start(1000)
            own.timer = window.setInterval(() => {
                const ms = Date.now() - own.startedAt
                meter.tick(ms, readPeak(own))
                if (ms >= MAX_RECORDING_MS) finish("limit")
            }, TICK_MS)
        } catch {
            // Some engines refuse a type isTypeSupported accepted; never leave the mic open.
            session?.source.disconnect()
            stopTracks(stream)
            unclaim()
            setStatus("idle")
            return "unknown"
        }

        sessionRef.current = session
        setStatus("recording")
        return null
    }

    useEffect(() => {
        void start().then((error) => {
            if (error) onStartErrorRef.current(error)
        })
        return () => cancel()
    }, [])

    return { status, meter, stop: () => finish("stopped"), cancel }
}
