export type StepTransition<T> = { shown: T; phase: "in" | "out"; pending?: T }

/** A new target fades the shown step out first; reduced motion switches at once. */
export const nextTransition = <T,>(state: StepTransition<T>, target: T, reduced: boolean): StepTransition<T> => {
    if (state.phase === "in" && state.shown === target) return state
    if (reduced) return { shown: target, phase: "in" }
    return { shown: state.shown, phase: "out", pending: target }
}

/** The fade-out finished: show what was waiting. */
export const settleTransition = <T,>(state: StepTransition<T>): StepTransition<T> =>
    state.phase === "out" && state.pending !== undefined ? { shown: state.pending, phase: "in" } : state
