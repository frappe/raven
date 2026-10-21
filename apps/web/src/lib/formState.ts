/**
 * True when the user has changed any field since the last reset.
 *
 * react-hook-form's `dirtyFields` only records user edits (and setValue calls
 * that ask for it). `isDirty` instead deep-compares every value against the
 * defaults, so a Frappe doc that omits an unset field reads as dirty on mount.
 * Field arrays store nested objects and arrays in the map, so walk the tree.
 */
export const hasDirtyFields = (dirtyFields: unknown): boolean => {
    if (dirtyFields === true) return true
    if (Array.isArray(dirtyFields)) return dirtyFields.some(hasDirtyFields)
    if (dirtyFields && typeof dirtyFields === "object") return Object.values(dirtyFields).some(hasDirtyFields)
    return false
}
