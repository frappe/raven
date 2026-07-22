import type { RavenMessageAction } from "@raven/types/RavenIntegrations/RavenMessageAction"

/**
 * The generated RavenMessageAction type is stale — the DocType's `action` Select
 * also allows "Server Script" and has a `server_script` Link field, both missing
 * from the generated type. Extend locally so the form handles existing data.
 */
export type MessageActionFormData = Omit<RavenMessageAction, "action"> & {
    action: "Create Document" | "Custom Function" | "Server Script"
    server_script?: string
}
