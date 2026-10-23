type RecordingMeterState = { elapsed: number; levels: number[] }

export type RecordingMeter = {
    get: () => RecordingMeterState
    subscribe: (listener: () => void) => () => void
    tick: (elapsed: number, level: number) => void
}

/**
 * The live timer and levels of one recording, outside React state: only the meter
 * that reads them re-renders on each tick, not the composer around it.
 */
export const createRecordingMeter = (maxLevels: number): RecordingMeter => {
    let state: RecordingMeterState = { elapsed: 0, levels: [] }
    const listeners = new Set<() => void>()
    return {
        get: () => state,
        subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        tick: (elapsed, level) => {
            state = { elapsed, levels: [...state.levels.slice(-(maxLevels - 1)), level] }
            listeners.forEach((listener) => listener())
        },
    }
}
