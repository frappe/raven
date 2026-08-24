import type { ReactNode } from "react"

interface SettingsPageHeaderProps {
    /** Page title */
    title: ReactNode
    /** Description text below the title */
    description?: ReactNode
    /** Action buttons displayed on the right side */
    actions?: ReactNode
}

/**
 * Header component for settings pages.
 * Displays title, optional description, and action buttons.
 *
 * @example
 * ```tsx
 * <SettingsPageHeader
 *   title="Custom Emojis"
 *   description="Upload and manage custom emojis."
 *   actions={<Button>Upload</Button>}
 * />
 * ```
 */
function SettingsPageHeader({
    title,
    description,
    actions,
}: SettingsPageHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">{title}</h2>
                {description && (
                    <p className="text-sm text-ink-gray-4">{description}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    )
}

export default SettingsPageHeader
