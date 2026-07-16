import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"

/**
 * Scaffold for a settings panel that isn't built out yet: the real header
 * (title + description — so DialogContent always has a DialogTitle) over an
 * Empty state. Each not-yet-built tab has its OWN panel file that renders this
 * with its copy, so building the real UI later is just filling in that file.
 */
export const PlaceholderPanel = ({
    title,
    description,
    icon: Icon,
    emptyTitle,
    emptyDescription,
}: {
    title: string
    description: string
    icon: React.ElementType
    /** Empty-state heading; defaults to `title`. */
    emptyTitle?: string
    emptyDescription: React.ReactNode
}) => (
    <>
        <SettingsPanelHeader>
            <SettingsPanelTitle>{title}</SettingsPanelTitle>
            <SettingsPanelDescription>{description}</SettingsPanelDescription>
        </SettingsPanelHeader>
        <SettingsPanelContent>
            <Empty className="h-full">
                <EmptyHeader>
                    <EmptyMedia><Icon /></EmptyMedia>
                    <EmptyTitle>{emptyTitle ?? title}</EmptyTitle>
                    <EmptyDescription>{emptyDescription}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        </SettingsPanelContent>
    </>
)
