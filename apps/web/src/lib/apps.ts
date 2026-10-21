/** Frappe HR is a separate app; its integrations apply only when it's on the site. */
export const isHRInstalled = (): boolean => window?.frappe?.boot?.versions?.hrms !== undefined
