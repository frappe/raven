import type { ReactNode } from "react"
import { useFrappeCreateDoc, useFrappeGetDoc, useFrappeUpdateDoc, useSWRConfig, type FrappeDoc, type SWRResponse } from "frappe-react-sdk"
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import ErrorBanner from "@components/ui/error-banner"
import { Form } from "@components/ui/form"
import { SettingsPanelContent, SettingsPanelHeader, SettingsPanelTitle } from "@components/ui/settings-dialog"
import { Spinner } from "@components/ui/spinner"
import useSaveHotkey from "@hooks/useSaveHotkey"
import RecordActionsMenu from "./RecordActionsMenu"
import _ from "@lib/translate"

type Props<T extends FieldValues> = {
    /** Set for detail/edit mode; absent for create mode. */
    id?: string
    doctype: string
    /** SWR key prefix of the panel's list — every page + count key under it is revalidated after create/save/delete. */
    listKey: string
    createDefaults: DefaultValues<T>
    createTitle: string
    backLabel: string
    deleteDescription: string
    title: (doc: T) => ReactNode
    form: (isEdit: boolean) => ReactNode
    /** Extra detail-mode header actions, rendered before Save. */
    actions?: (doc: T) => ReactNode
    onBack: () => void
    onSaved?: (id: string) => void
    onDeleted?: () => void
}

/** Create/detail editor chrome shared by the settings CRUD panels: header, back, Save/Create, Not-Saved badge, ⌘S, delete. */
const SettingsRecordEditor = <T extends FieldValues>(props: Props<T>) => {
    if (props.id) return <Detail {...props} id={props.id} />
    return <Create {...props} />
}

const BackButton = ({ onBack, label }: { onBack: () => void; label: string }) => (
    <Button type="button" variant="ghost" size="sm" isIconButton onClick={onBack} aria-label={label}>
        <ArrowLeftIcon />
    </Button>
)

const Create = <T extends FieldValues>({
    doctype, listKey, createDefaults, createTitle, backLabel, form, onBack, onSaved,
}: Props<T>) => {
    const { createDoc, loading, error } = useFrappeCreateDoc<T>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<T>({ defaultValues: createDefaults })
    const { handleSubmit } = methods

    const onSubmit = async (data: T) => {
        const doc = await createDoc(doctype, data)
        await globalMutate((key) => typeof key === "string" && key.startsWith(listKey))
        onSaved?.(doc.name)
    }

    // Guard: ⌘S auto-repeat would fire handleSubmit again mid-create and duplicate the record.
    useSaveHotkey(() => { if (!loading) handleSubmit(onSubmit)() })

    return (
        <Form {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <Button type="submit" size="sm" disabled={loading}>
                            {loading && <Spinner />}
                            {loading ? _("Creating") : _("Create")}
                        </Button>
                    }
                >
                    <SettingsPanelTitle className="items-center h-auto -ml-2">
                        <BackButton onBack={onBack} label={backLabel} />
                        {createTitle}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    {form(false)}
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

const Detail = <T extends FieldValues>(props: Props<T> & { id: string }) => {
    const { data, isLoading, error, mutate } = useFrappeGetDoc<T>(props.doctype, props.id)

    if (error) {
        return (
            <SettingsPanelContent>
                <ErrorBanner error={error} />
            </SettingsPanelContent>
        )
    }
    if (isLoading || !data) {
        return (
            <SettingsPanelContent className="items-center justify-center">
                <Spinner />
            </SettingsPanelContent>
        )
    }
    return <DetailContent {...props} data={data} mutate={mutate} />
}

const DetailContent = <T extends FieldValues>({
    id, doctype, listKey, createDefaults, backLabel, deleteDescription, title, form, actions, onBack, onDeleted, data, mutate,
}: Props<T> & { id: string; data: T; mutate: SWRResponse<FrappeDoc<T>>["mutate"] }) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<T>()
    const { mutate: globalMutate } = useSWRConfig()
    // Seed missing (unset) fields from createDefaults so a toggle round-trip is not reported dirty.
    const methods = useForm<T>({ defaultValues: { ...createDefaults, ...data } as DefaultValues<T> })
    const { handleSubmit, formState: { isDirty } } = methods

    const onSubmit = async (formData: T) => {
        const doc = await updateDoc(doctype, id, formData)
        toast.success(_("Saved"))
        methods.reset({ ...createDefaults, ...doc } as T)
        mutate(doc, { revalidate: false })
        await globalMutate((key) => typeof key === "string" && key.startsWith(listKey))
    }

    useSaveHotkey(() => { if (!loading) handleSubmit(onSubmit)() })

    return (
        <Form {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <div className="flex items-center gap-2">
                            <RecordActionsMenu
                                doctype={doctype}
                                docName={id}
                                deleteDescription={deleteDescription}
                                onDeleted={async () => {
                                    await globalMutate((key) => typeof key === "string" && key.startsWith(listKey))
                                    onDeleted?.()
                                }}
                            />
                            {actions?.(data)}
                            <Button type="submit" size="sm" disabled={loading}>
                                {loading && <Spinner />}
                                {loading ? _("Saving") : _("Save")}
                            </Button>
                        </div>
                    }
                >
                    <SettingsPanelTitle className="items-center h-auto -ml-2">
                        <BackButton onBack={onBack} label={backLabel} />
                        {title(data)}
                        {isDirty && <Badge variant="outline">{_("Not Saved")}</Badge>}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-4">
                    {error && <ErrorBanner error={error} />}
                    {form(true)}
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

export default SettingsRecordEditor
