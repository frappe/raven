import * as React from "react"
import { SettingsDialogContext } from "./settings-dialog-context"
import { Tabs as TabsPrimitive, Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@lib/utils"
import { DialogContent } from "./dialog"
import { Label } from "./label"

/**
 * Sample Usage:
 *
 * <Dialog open={open} onOpenChange={setOpen}>
 * <DialogTrigger>
 * ...your content...
 * </DialogTrigger>
 * 
 *   <SettingsDialog onClose={() => setOpen(false)} defaultValue="preferences">
 *     <SettingsTabs>
 *       <SettingsTabGroup header="Configuration">
 *         <SettingsTabItem icon={<SlidersVerticalIcon />} label="Preferences" value="preferences" />
 *         <SettingsTabItem icon={<ZapIcon />} label="Matching Rules" value="rules" />
 *       </SettingsTabGroup>
 *       <SettingsTabGroup header="Setup">
 *         <SettingsTabItem icon={<LandmarkIcon />} label="Bank Accounts" value="bank-accounts" />
 *         <SettingsTabItem icon={<ListIcon />} label="Masters" value="masters" />
 *       </SettingsTabGroup>
 *     </SettingsTabs>
 *
 *     <SettingsPanels>
 *       <SettingsPanel value="preferences"><Preferences /></SettingsPanel>
 *       <SettingsPanel value="rules"><MatchingRules /></SettingsPanel>
 *       <SettingsPanel value="bank-accounts"><BankAccounts /></SettingsPanel>
 *       <SettingsPanel value="masters"><Masters /></SettingsPanel>
 *     </SettingsPanels>
 *   </SettingsDialog>
 * </Dialog>
 */


type SettingsDialogProps = Omit<
    React.ComponentProps<typeof TabsPrimitive.Root>,
    "orientation"
> & {
    onClose?: VoidFunction
    contentClassName?: string
}

function SettingsDialog({
    children,
    className,
    contentClassName,
    onClose,
    ...props
}: SettingsDialogProps) {
    const contextValue = React.useMemo(() => ({ onClose }), [onClose])

    return (
        <DialogContent className={cn("min-w-5xl max-lg:min-w-[98vw] p-0 overflow-y-hidden", contentClassName)} showCloseButton={false}>
            <SettingsDialogContext.Provider value={contextValue}>
                <TabsPrimitive.Root
                    data-slot="settings-dialog"
                    orientation="vertical"
                    className={cn(
                        "flex h-[calc(100vh-8rem)] bg-surface-sidebar",
                        className
                    )}
                    {...props}
                >
                    {children}
                </TabsPrimitive.Root>
            </SettingsDialogContext.Provider>
        </DialogContent>
    )
}

function SettingsTabs({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            data-slot="settings-tabs"
            className={cn(
                "flex flex-col w-56 bg-surface-sidebar rounded-s-lg shrink-0 overflow-y-auto m-1",
                className
            )}
            {...props}
        />
    )
}

type SettingsTabGroupProps = React.ComponentProps<"div"> & {
    header?: React.ReactNode
}

function SettingsTabGroup({
    children,
    header,
    className,
    ...props
}: SettingsTabGroupProps) {
    return (
        <div data-slot="settings-tab-group" className={className} {...props}>
            {header && (
                <div className="h-7.5 px-2 py-[7px] my-[3px] flex cursor-default gap-1.5 text-xs-medium text-ink-gray-5 transition-all duration-300 ease-in-out sticky top-0 z-10 bg-surface-sidebar dark:bg-surface-elevation-1">
                    <span>{header}</span>
                </div>
            )}
            <nav className="space-y-[3px] px-1">{children}</nav>
            <div className="mb-0.5 mt-[5px]"></div>
        </div>
    )
}

type SettingsTabItemProps = React.ComponentProps<typeof TabsPrimitive.Trigger> & {
    icon?: React.ReactNode
    label: React.ReactNode
}

function SettingsTabItem({
    icon,
    label,
    className,
    ...props
}: SettingsTabItemProps) {
    return (
        <TabsPrimitive.Trigger
            data-slot="settings-tab-item"
            className={cn(
                "flex h-7.5 cursor-pointer items-center rounded text-ink-gray-6 duration-300 ease-in-out focus-visible:focus-ring w-full",
                "hover:bg-surface-gray-3",
                "data-[state=active]:bg-surface-elevation-3 data-[state=active]:shadow-sm data-[state=active]:hover:bg-surface-elevation-3",
                className
            )}
            {...props}
        >
            <div className="flex w-full items-center justify-between duration-300 ease-in-out px-2 py-[7px]">
                <div className="flex items-center truncate">
                    {icon && (
                        <div className="[&_svg:not([class*='size-'])]:size-4 text-ink-gray-6 [&_svg:not([class*='text-'])]:text-ink-gray-6">
                            {icon}
                        </div>
                    )}
                    <span
                        className={cn(
                            "flex-1 shrink-0 truncate text-sm leading-snug duration-300 ease-in-out w-auto opacity-100 text-ink-gray-6",
                            icon && "ms-2"
                        )}
                    >
                        {label}
                    </span>
                </div>
            </div>
        </TabsPrimitive.Trigger>
    )
}

function SettingsPanels({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="settings-panels"
            className={cn(
                "flex flex-col flex-1 overflow-y-auto bg-surface-base",
                className
            )}
            {...props}
        />
    )
}

function SettingsPanel({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            data-slot="settings-panel"
            className={cn("flex flex-col h-full w-full text-ink-gray-8 py-8 px-6 gap-6", className)}
            {...props}
        />
    )
}

/**
 * Usage:
 * 
 * <SettingsPanelHeader actions={<><Button>Add</Button></>}>
 * 
 * <SettingsPanelTitle>Settings</SettingsPanelTitle>
 * <SettingsPanelDescription>Settings description</SettingsPanelDescription>
 * 
 * </SettingsPanelHeader>
 */
function SettingsPanelHeader({
    className,
    children,
    actions,
    ...props
}: React.ComponentProps<"div"> & { actions?: React.ReactNode }) {
    return (
        <div
            data-slot="dialog-header"
            className={cn("flex justify-between items-start px-2 text-ink-gray-7", className)}
            {...props}
        >
            <div className="flex flex-col gap-1 w-full">
                {children}
            </div>
            <div className="flex items-center space-x-2 w-fit justify-end">
                {actions}
            </div>
        </div>
    )
}

function SettingsPanelTitle({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn("flex gap-2 text-xl-semibold text-ink-gray-8 leading-none h-5", className)}
            {...props}
        />
    )
}

function SettingsPanelDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn("text-p-base text-ink-gray-6", className)}
            {...props}
        />
    )
}

function SettingsPanelContent({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div className={cn("flex-1 flex flex-col overflow-y-auto px-2", className)} {...props} />
    )
}

/** Common components for forms */

/** Used to render a row in a form in the settings panel */
const SettingsFormRow = (props: React.ComponentProps<"div">) => {
    return <div className="flex justify-between items-center gap-8 py-2" {...props} />
}

/** Used to render a label for a form field in the settings panel */
const SettingsFormLabel = (props: React.ComponentProps<typeof Label>) => {
    return (
        <Label
            htmlFor="filter_recent_activity"
            className="text-p-base text-ink-gray-8"
            {...props} />
    )
}

/** Used to render a description for a form field in the settings panel */
const SettingsFormDescription = (props: React.ComponentProps<"p">) => {
    return (
        <p className="text-p-sm text-ink-gray-5" {...props} />
    )
}

/** Groups rows under a small heading inside a settings panel. Extra top
 *  padding separates it from the previous section (none when it's first). */
const SettingsSectionHeader = ({ className, ...props }: React.ComponentProps<"h3">) => {
    return (
        <h3 className={cn("pt-4 text-base text-ink-gray-5 first:pt-0", className)} {...props} />
    )
}

export {
    SettingsDialog,
    SettingsTabs,
    SettingsTabGroup,
    SettingsTabItem,
    SettingsPanels,
    SettingsPanel,
    SettingsPanelHeader,
    SettingsPanelTitle,
    SettingsPanelDescription,
    SettingsPanelContent,
    SettingsFormRow,
    SettingsFormLabel,
    SettingsFormDescription,
    SettingsSectionHeader
}
