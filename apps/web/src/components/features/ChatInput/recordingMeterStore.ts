/**
 * `heights` are 0–100, fixed once drawn; `tickedAt` (performance.now) times the scroll between ticks;
 * `count` numbers the ticks, so each bar keeps one identity as it scrolls.
 */
type RecordingMeterState = { elapsed: number; heights: number[]; tickedAt: number; count: number }

export type RecordingMeter = {
    get: () => RecordingMeterState
    subscribe: (listener: () => void) => () => void
    tick: (elapsed: number, level: number, at?: number) => void
}

/** How often the recorder samples the mic: one bar per tick. */
export const TICK_MS = 100

// Quiet speech peaks around 0.15: scaling against at least this keeps room noise low before anyone speaks.
const LOUDEST_FLOOR = 0.15
// Per tick the scale relaxes (half-life ~3.4s), so one spike doesn't shrink the rest of the take.
const LOUDEST_DECAY = 0.98

/**
 * The live timer and levels of one recording, outside React state: only the meter
 * that reads them re-renders on each tick, not the composer around it.
 */
export const createRecordingMeter = (maxLevels: number): RecordingMeter => {
    let state: RecordingMeterState = { elapsed: 0, heights: [], tickedAt: 0, count: 0 }
    // The recent loudest level: each bar is scaled once against it, so bars keep their shape as they scroll.
    let loudest = LOUDEST_FLOOR
    const listeners = new Set<() => void>()
    return {
        get: () => state,
        subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        tick: (elapsed, level, at = performance.now()) => {
            loudest = Math.max(LOUDEST_FLOOR, level, loudest * LOUDEST_DECAY)
            const height = Math.round((level / loudest) * 100)
            state = { elapsed, heights: [...state.heights.slice(-(maxLevels - 1)), height], tickedAt: at, count: state.count + 1 }
            listeners.forEach((listener) => listener())
        },
    }
}
