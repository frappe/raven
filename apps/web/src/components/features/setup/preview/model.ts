import type { RavenChannel } from "@raven/types/RavenChannelManagement/RavenChannel"

/** Someone in the DM list; a blank name is an invite row not filled in yet. The id keeps their row mounted as the list changes. */
export type PreviewPerson = { id: string; name: string; image?: string }

/** What the preview window shows; absent parts render as skeleton bars. */
export type PreviewModel = {
    profile?: { name: string; image?: string }
    workspace?: { name: string; logo?: string }
    channel?: { name: string; type?: RavenChannel["type"] }
    people: PreviewPerson[]
    /** Frappe HR's leave indicator is on: people show on leave. */
    leave: boolean
}

/** The open step's unsaved fields. Cleared whenever the step changes. The team step lists everyone, so its people replace the saved ones. */
export type PreviewDraft = Partial<Pick<PreviewModel, "profile" | "workspace" | "channel" | "people" | "leave">>

const filled = (value?: string): value is string => !!value?.trim()

/** A named part from the draft over the saved one; a blank name falls back to the saved one. */
const merge = <P extends { name: string }>(saved?: P, draft?: Partial<P>): P | undefined => {
    const name = filled(draft?.name) ? draft.name.trim() : saved?.name
    if (!filled(name)) return undefined
    return { ...saved, ...draft, name } as P
}

export const buildPreviewModel = (saved: PreviewModel, draft: PreviewDraft): PreviewModel => ({
    profile: merge(saved.profile, draft.profile),
    workspace: merge(saved.workspace, draft.workspace),
    channel: merge(saved.channel, draft.channel),
    people: draft.people ?? saved.people,
    leave: draft.leave ?? saved.leave,
})
