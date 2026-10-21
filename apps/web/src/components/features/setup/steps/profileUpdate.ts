type ProfileFields = { full_name: string; user_image: string }
type ProfileUpdate = { full_name?: string; user_image?: string; onboarded: 1 }

/** Always marks the user onboarded; the name and photo go along only when they changed. */
export const buildProfileUpdate = (saved: { full_name?: string | null; user_image?: string | null }, typed: ProfileFields): ProfileUpdate => {
    const update: ProfileUpdate = { onboarded: 1 }
    const name = typed.full_name.trim()
    if (name && name !== (saved.full_name ?? "").trim()) update.full_name = name
    if (typed.user_image !== (saved.user_image ?? "")) update.user_image = typed.user_image
    return update
}
