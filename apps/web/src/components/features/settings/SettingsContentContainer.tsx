import type { PropsWithChildren, ReactNode } from "react"
import SettingsPageHeader from "@components/features/settings/SettingsPageHeader"

interface SettingsContentContainerProps {
  /** Page title displayed in the header */
  title: string
  /** Description text below the title */
  description?: ReactNode
  /** Action buttons (e.g., "Create" button) displayed on the right */
  actions?: ReactNode
}

/**
 * Container component for settings pages.
 * Provides consistent layout with header, description, and content area.
 *
 * @example
 * ```tsx
 * <SettingsContentContainer
 *   title="Workspaces"
 *   description="Manage your workspaces."
 *   actions={<Button>Create</Button>}
 * >
 *   <DataTable ... />
 * </SettingsContentContainer>
 * ```
 */
function SettingsContentContainer({
  title,
  description,
  actions,
  children,
}: PropsWithChildren<SettingsContentContainerProps>) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <SettingsPageHeader
        title={title}
        description={description}
        actions={actions}
      />
        {children}
    </div>
  )
}

export default SettingsContentContainer
