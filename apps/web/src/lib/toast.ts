/**
 * One toast id for every "save this form" result. Sonner updates a toast with
 * the same id in place and restarts its timer, so repeated saves (or a held
 * Cmd+S) refresh a single toast instead of stacking one per save. Only one
 * settings form is on screen at a time, so sharing the id is safe, and it
 * means an error replaces a stale "Saved" rather than sitting next to it.
 */
export const SAVE_TOAST_ID = "form-save"
