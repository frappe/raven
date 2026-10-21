/** Progress value kept inside 0–100; NaN is an empty bar. */
export const clampProgress = (value: number): number =>
    Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), 100)

/** Whole segments filled for a value, as frappe-ui's interval bar counts them. */
export const getFilledIntervals = (value: number, intervals: number): number =>
    Math.round((clampProgress(value) / 100) * intervals)
