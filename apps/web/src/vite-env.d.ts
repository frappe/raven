/// <reference types="vite/client" />

interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    frappe?: any,
    /**
     * Desk's document cache. Present only under /app — this SPA never loads desk's
     * bundle, so treat it as optional and always read it off `window`: a bare
     * `locals` identifier throws ReferenceError before optional chaining applies.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    locals?: any,
    /** Injected by the Jinja entry template (raven.html) for POSTs outside frappe-react-sdk */
    csrf_token?: string,
}