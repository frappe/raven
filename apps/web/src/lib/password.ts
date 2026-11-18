/** Frappe sends a stored password back as asterisks only; revealing those shows nothing. */
export const isMaskedPassword = (value: unknown) => typeof value === "string" && /^\*+$/.test(value)
