/** Google passes the Processor.State enum raw — DISABLED/FAILED are truthy, so a bare truthy check is wrong. */
export const isProcessorActive = (state: string | number | undefined) =>
    state === "ENABLED" || state === 1
