/**
 * Check if user can read a document
 * @param {string} doctype
 **/
export const canReadDocument = (doctype: string) => {
    return window.frappe?.boot?.user?.can_read?.includes(doctype) || false
}


/**
 * Check if user can write a document
 * @param {string} doctype
 **/
export const canWriteDocument = (doctype: string) => {
    return window.frappe?.boot?.user?.can_write?.includes(doctype) || false
}


/**
 * Check if user can create a document
 * @param {string} doctype
 **/
export const canCreateDocument = (doctype: string) => {
    return window.frappe?.boot?.user?.can_create?.includes(doctype) || false
}


/**
 * Check if user can delete a document
 * @param {string} doctype
 **/
export const canDeleteDocument = (doctype: string) => {
    return window.frappe?.boot?.user?.can_delete?.includes(doctype) || false
}


/**
 * Check if user can cancel a document
 * @param {string} doctype
 **/
export const canCancelDocument = (doctype: string) => {
    return window.frappe?.boot?.user?.can_cancel?.includes(doctype) || false
}


/**
 * Check if user can search a document
 * @param {string} doctype
 **/
export const canSearchDocument = (doctype: string) => {
    return window.frappe?.boot?.user?.can_search?.includes(doctype) || false
}


/**
 * Check if user can import a document
 * @param {string} doctype
 **/
export const canImportDocument = (doctype: string) => {
    return window.frappe?.boot?.user?.can_import?.includes(doctype) || false
}


/**
 * Check if user can export a document
 * @param {string} doctype
 **/
export const canExportDocument = (doctype: string) => {
    return window.frappe?.boot?.user?.can_export?.includes(doctype) || false
}
/**
 * Check if the user has a role
 * @param {string} role
 * @returns boolean
 */
export const hasRole = (role: string) => {
    return window.frappe?.boot?.user?.roles?.includes(role) || false
}

/**
 * Whether the current user may change a channel's settings (rename, change type,
 * archive, delete, manage members): they are an admin OF the channel, or a Raven
 * Admin who is at least a member of it.
 */
export const canManageChannel = (channel?: { is_admin?: 0 | 1; member_id?: string } | null): boolean => {
    if (!channel) return false
    if (channel.is_admin === 1) return true
    return Boolean(channel.member_id) && hasRole("Raven Admin")
}