import { useFrappeGetDoc, useFrappeUpdateDoc, useSWRConfig } from "frappe-react-sdk"
import { FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeftIcon, LayoutPanelTopIcon, UsersIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import {
    SettingsPanelContent, SettingsPanelHeader, SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import type { RavenWorkspace } from "@raven/types/Raven/RavenWorkspace"
import _ from "@lib/translate"
import { useWorkspaces } from "@hooks/useWorkspaces"
import WorkspaceEditForm from "./WorkspaceEditForm"
import WorkspaceActionMenu from "./WorkspaceActionMenu"
import WorkspaceMembers from "./WorkspaceMembers"

/** Extends the generated type with the field that exists in the DocType but is not yet in the TS definition. */
export type WorkspaceFormData = RavenWorkspace & {
    only_admins_can_create_channels?: 0 | 1
}

type Props = { workspaceID: string; onBack: () => void }

/** In-panel workspace admin view: details form + member management. */
const WorkspaceDetailView = ({ workspaceID, onBack }: Props) => {
    const { data, isLoading, error, mutate } = useFrappeGetDoc<RavenWorkspace>("Raven Workspace", workspaceID)

    return (
        <>
            {error && (
                <SettingsPanelContent>
                    <ErrorBanner error={error} />
                </SettingsPanelContent>
            )}
            {isLoading && (
                <SettingsPanelContent className="items-center justify-center">
                    <Spinner />
                </SettingsPanelContent>
            )}
            {data && <WorkspaceDetailContent data={data} mutate={() => { void mutate() }} onBack={onBack} />}
        </>
    )
}

/**
 * Frappe omits unset (None) fields from the doc, but the form registers them —
 * RHF's isDirty deep-compare then sees a key-count mismatch and reports dirty
 * on mount. Give every form-managed field an explicit default.
 */
const toFormDefaults = (doc: RavenWorkspace): WorkspaceFormData => ({
    ...doc,
    description: doc.description ?? "",
    logo: doc.logo ?? "",
    only_admins_can_create_channels: (doc as WorkspaceFormData).only_admins_can_create_channels ?? 0,
})

const WorkspaceDetailContent = ({
    data, mutate, onBack,
}: { data: RavenWorkspace; mutate: () => void; onBack: () => void }) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<WorkspaceFormData>()
    const { mutate: globalMutate } = useSWRConfig()
    // Anyone can open a workspace; only its admins can change it. The doc from
    // get_doc carries no membership info, so admin-ness comes from the list API.
    const { workspaces } = useWorkspaces()
    const canEdit = !!workspaces.find((workspace) => workspace.name === data.name)?.is_admin

    const methods = useForm<WorkspaceFormData>({ defaultValues: toFormDefaults(data) })
    const isDirty = methods.formState.isDirty

    const onSubmit = (formData: WorkspaceFormData) => {
        updateDoc("Raven Workspace", formData.name, formData).then((doc) => {
            toast.success(_("Saved"))
            methods.reset(doc ? toFormDefaults(doc) : undefined)
            globalMutate("workspaces_list")
            globalMutate("channel_list")
            mutate()
        })
    }

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        canEdit ? (
                            <div className="flex items-center gap-2">
                                <WorkspaceActionMenu
                                    workspaceID={data.name}
                                    workspaceName={data.workspace_name}
                                    onDeleted={onBack}
                                    onRenamed={() => onBack()}
                                />
                                <Button type="submit" size="sm" disabled={loading}>
                                    {loading && <Spinner />}
                                    {loading ? _("Saving") : _("Save")}
                                </Button>
                            </div>
                        ) : null
                    }
                >
                    <SettingsPanelTitle className="items-center h-auto -ml-2">
                        <Button
                            type="button" variant="ghost" size="sm" isIconButton
                            onClick={onBack} aria-label={_("Back to workspaces")}
                        >
                            <ArrowLeftIcon />
                        </Button>
                        {data.workspace_name}
                        {isDirty && <Badge variant="outline">{_("Not Saved")}</Badge>}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    <Tabs defaultValue="details">
                        <TabsList>
                            <TabsTrigger value="details">
                                <LayoutPanelTopIcon /> {_("Details")}
                            </TabsTrigger>
                            <TabsTrigger value="members">
                                <UsersIcon /> {_("Members")}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="pt-4">
                            {/* The fieldset covers the plain form controls. It is NOT enough on
                                its own: it suppresses `click`, but `pointerdown` still fires on a
                                disabled control, so a Radix trigger (which opens on pointerdown)
                                would still open — and its content is portalled outside the
                                fieldset, beyond the disable. Anything Radix-triggered therefore
                                takes an explicit `disabled` prop as well. */}
                            <fieldset disabled={!canEdit} className="contents">
                                <WorkspaceEditForm disabled={!canEdit} />
                            </fieldset>
                        </TabsContent>
                        <TabsContent value="members" className="pt-4 flex-1 min-h-0">
                            <WorkspaceMembers workspaceID={data.name} />
                        </TabsContent>
                    </Tabs>
                </SettingsPanelContent>
            </form>
        </FormProvider>
    )
}

export default WorkspaceDetailView
