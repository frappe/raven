import type { PreviewDraft } from "./preview/model"

/** Someone on the site setup could add: in Raven but in no workspace, or a system user not in Raven yet. */
export type SiteUser = {
    user: string
    full_name: string
    user_image?: string
    in_raven?: boolean
    /** Off when their single role profile can't take Raven's (Frappe 15). */
    addable?: boolean
    role_profile?: string | null
}

export type Invitee = { email: string; first_name: string }

/** What setup has made so far; later steps read it. */
export type SetupState = {
    /** Workspace doc name */
    workspace?: string
    /** Channel doc name, and the name people see */
    channel?: { id: string; name: string }
    invited: Invitee[]
    addedSiteUsers: SiteUser[]
}

export type SetupStepBodyProps = {
    setup: SetupState
    /** The step's main button finishes setup */
    isLast: boolean
    /** Finishing is in flight */
    finishing: boolean
    /** Absent on the first step */
    onBack?: () => void
    onDone: (patch?: Partial<SetupState>) => void
    onSkip: () => void
    /** Records what a step made without moving on (e.g. a rename whose follow-up save failed) */
    onSave: (patch: Partial<SetupState>) => void
    /** What the open step's form holds right now, for the preview */
    onPreview: (patch: PreviewDraft) => void
    /** A save or upload is in flight; Back waits for it, or the save would settle a step already left */
    onBusyChange: (busy: boolean) => void
}
