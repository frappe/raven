export type Speed = 1 | 1.5 | 2
export const SPEEDS: readonly Speed[] = [1, 1.5, 2]

export type PlaybackState = {
    activeId: string | null
    playing: boolean
    /** Where each note was left, for resume. Cleared when a note ends. */
    positions: ReadonlyMap<string, number>
    errors: ReadonlySet<string>
    speed: Speed
}

export type NotePlayback = { playing: boolean; position: number; error: boolean; speed: Speed; showSpeed: boolean }

export const initialPlayback = (speed: Speed = 1): PlaybackState => ({
    activeId: null,
    playing: false,
    positions: new Map(),
    errors: new Set(),
    speed,
})

export const nextSpeed = (speed: Speed): Speed => SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]

const withPosition = (positions: ReadonlyMap<string, number>, id: string, seconds: number) => {
    const next = new Map(positions)
    next.set(id, seconds)
    return next
}

/** Start or resume `id`; saves where the previously active note stopped. */
export const play = (state: PlaybackState, id: string, previousPosition: number): PlaybackState => {
    const switching = state.activeId !== null && state.activeId !== id
    const errors = state.errors.has(id) ? new Set([...state.errors].filter((e) => e !== id)) : state.errors
    return {
        ...state,
        activeId: id,
        playing: true,
        positions: switching ? withPosition(state.positions, state.activeId as string, previousPosition) : state.positions,
        errors,
    }
}

export const pause = (state: PlaybackState, position: number): PlaybackState =>
    state.activeId && state.playing
        ? { ...state, playing: false, positions: withPosition(state.positions, state.activeId, position) }
        : state

export const tick = (state: PlaybackState, position: number): PlaybackState =>
    state.activeId && state.positions.get(state.activeId) !== position
        ? { ...state, positions: withPosition(state.positions, state.activeId, position) }
        : state

export const end = (state: PlaybackState): PlaybackState => {
    if (!state.activeId) return state
    const positions = new Map(state.positions)
    positions.delete(state.activeId)
    return { ...state, playing: false, positions }
}

export const fail = (state: PlaybackState): PlaybackState =>
    state.activeId ? { ...state, playing: false, errors: new Set([...state.errors, state.activeId]) } : state

export const seek = (state: PlaybackState, id: string, seconds: number): PlaybackState => ({
    ...state,
    positions: withPosition(state.positions, id, Math.max(0, seconds)),
})

/** Drop these notes' positions; the active one among them stops. */
export const forget = (state: PlaybackState, ids: readonly string[]): PlaybackState => {
    const positions = new Map(state.positions)
    ids.forEach((id) => positions.delete(id))
    const stopsActive = state.activeId !== null && ids.includes(state.activeId)
    return { ...state, positions, activeId: stopsActive ? null : state.activeId, playing: stopsActive ? false : state.playing }
}

export const setSpeed = (state: PlaybackState, speed: Speed): PlaybackState =>
    speed === state.speed ? state : { ...state, speed }

export const selectNote = (state: PlaybackState, id: string): NotePlayback => {
    const playing = state.activeId === id && state.playing
    const position = state.positions.get(id) ?? 0
    return {
        playing,
        position,
        error: state.errors.has(id),
        speed: state.speed,
        showSpeed: playing || position > 0 || state.speed !== 1,
    }
}
