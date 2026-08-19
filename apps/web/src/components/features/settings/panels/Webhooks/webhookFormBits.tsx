/** Small shared field helpers for the webhook form tabs. */

export const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="text-p-sm text-ink-red-3">{message}</p> : null

export const FieldHelp = ({ children }: { children: React.ReactNode }) => (
    <p className="text-p-sm text-ink-gray-5">{children}</p>
)
