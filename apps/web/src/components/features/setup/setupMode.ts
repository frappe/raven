export type SetupMode = "admin" | "profile" | null

/** The first admin's full flow wins; anyone else not onboarded sets up their profile. */
export const getSetupMode = ({ setupPending, onboarded }: { setupPending: boolean; onboarded: boolean }): SetupMode =>
    setupPending ? "admin" : !onboarded ? "profile" : null
