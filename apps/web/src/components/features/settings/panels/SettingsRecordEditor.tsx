import type { ReactNode } from "react"
import { SAVE_TOAST_ID } from "@lib/toast"
import { hasDirtyFields } from "@lib/formState"
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

/** What a custom menu item gets: the loaded record, the busy flag, and a safe way to change the record. */
export type RecordMenuContext<T extends FieldValues> = {
    doc: T
    loading: boolean
    /**
     * Saves a partial update right away, then refreshes the form's defaults from the saved
     * doc (new values, new `modified` stamp) while keeping the user's unsaved edits. A later
     * Save then neither undoes this change nor trips Frappe's timestamp check.
     * A failed update is shown in the editor's error banner and never rejects.
     */
    update: (values: Partial<T>, successMessage: string) => Promise<void>
}

type Props<T extends FieldValues> = {
    /** Set for detail/edit mode; absent for create mode. */
    id?: string
    doctype: string
    /** SWR key prefix of the panel's list — every page + count key under it is revalidated after create/save/delete. */
    listKey: string
    createDefaults: DefaultValues<T>
    createTitle: string
    backLabel: string
    /** Confirm-dialog heading, e.g. "Delete Webhook?". */
    deleteTitle: string
    /** Confirm-dialog body. Gets the record so it can show its title, not its id. */
    deleteDescription: (doc: T) => string
    title: (doc: T) => ReactNode
    form: (isEdit: boolean) => ReactNode
    /** Extra detail-mode header actions, rendered before Save. */
    actions?: (doc: T) => ReactNode
    /** Extra items for the actions menu, rendered above Delete. */
    menu?: (ctx: RecordMenuContext<T>) => ReactNode
    /** Status badge next to the title. Hidden while there are unsaved changes. */
    badge?: (doc: T) => ReactNode
    /** Toast after a successful delete. Defaults to "Deleted". */
    deleteSuccessMessage?: string
    /**
     * Optional transforms between the saved doc and the form's values, for forms that
     * edit derived fields (e.g. cron parts). `toForm` runs on every load and reset,
     * `fromForm` on every create and save.
     */
    toForm?: (doc: T) => T
    fromForm?: (values: T) => T
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
    doctype, listKey, createDefaults, createTitle, backLabel, form, fromForm, onBack, onSaved,
}: Props<T>) => {
    const { createDoc, loading, error } = useFrappeCreateDoc<T>()
    const { mutate: globalMutate } = useSWRConfig()
    const methods = useForm<T>({ defaultValues: createDefaults })
    const { handleSubmit } = methods

    const onSubmit = async (data: T) => {
        const doc = await createDoc(doctype, fromForm ? fromForm(data) : data)
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
                        <Button type="submit" size="sm" loading={loading} loadingText={_("Creating")}>
                            {_("Create")}
                        </Button>
                    }
                >
                    <SettingsPanelTitle className="items-center h-auto -ml-2">
                        <BackButton onBack={onBack} label={backLabel} />
                        {createTitle}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-2">
                    {error && <ErrorBanner error={error} />}
                    {form(false)}
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

const Detail = <T extends FieldValues>(props: Props<T> & { id: string }) => {
    const { data, isLoading, error, mutate } = useFrappeGetDoc<T>(props.doctype, props.id, undefined, { errorRetryCount: 2 })

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
    id, doctype, listKey, createDefaults, backLabel, deleteTitle, deleteDescription, deleteSuccessMessage,
    title, form, actions, menu, badge, toForm, fromForm, onBack, onDeleted, data, mutate,
}: Props<T> & { id: string; data: T; mutate: SWRResponse<FrappeDoc<T>>["mutate"] }) => {
    const { updateDoc, loading, error } = useFrappeUpdateDoc<T>()
    const { mutate: globalMutate } = useSWRConfig()
    // Seed missing (unset) fields from createDefaults so a toggle round-trip is not reported dirty.
    const formValues = (doc: T) => {
        const merged = { ...createDefaults, ...doc } as T
        return toForm ? toForm(merged) : merged
    }
    const methods = useForm<T>({ defaultValues: formValues(data) as DefaultValues<T> })
    const { handleSubmit, formState: { dirtyFields } } = methods
    const hasChanges = hasDirtyFields(dirtyFields)

    const onSubmit = async (formData: T) => {
        const doc = await updateDoc(doctype, id, fromForm ? fromForm(formData) : formData)
        toast.success(_("Saved"), { id: SAVE_TOAST_ID })
        methods.reset(formValues(doc))
        mutate(doc, { revalidate: false })
        await globalMutate((key) => typeof key === "string" && key.startsWith(listKey))
    }

    useSaveHotkey(() => { if (!loading) handleSubmit(onSubmit)() })

    // See RecordMenuContext.update.
    const update = (values: Partial<T>, successMessage: string) =>
        updateDoc(doctype, id, values)
            .then(async (doc) => {
                toast.success(successMessage, { id: SAVE_TOAST_ID })
                methods.reset(formValues(doc), { keepDirtyValues: true })
                mutate(doc, { revalidate: false })
                await globalMutate((key) => typeof key === "string" && key.startsWith(listKey))
            })
            .catch(() => { /* surfaced by the error banner */ })

    return (
        <Form {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="contents">
                <SettingsPanelHeader
                    actions={
                        <div className="flex items-center gap-2">
                            <RecordActionsMenu
                                doctype={doctype}
                                docName={id}
                                deleteTitle={deleteTitle}
                                deleteDescription={deleteDescription(data)}
                                deleteSuccessMessage={deleteSuccessMessage}
                                onDeleted={async () => {
                                    await globalMutate((key) => typeof key === "string" && key.startsWith(listKey))
                                    onDeleted?.()
                                }}
                            >
                                {menu?.({ doc: data, loading, update })}
                            </RecordActionsMenu>
                            {actions?.(data)}
                            <Button type="submit" size="sm" loading={loading} loadingText={_("Saving")}>
                                {_("Save")}
                            </Button>
                        </div>
                    }
                >
                    <SettingsPanelTitle className="items-center h-auto -ml-2">
                        <BackButton onBack={onBack} label={backLabel} />
                        {title(data)}
                        {hasChanges ? <Badge variant="subtle">{_("Not Saved")}</Badge> : badge?.(data)}
                    </SettingsPanelTitle>
                </SettingsPanelHeader>
                <SettingsPanelContent className="min-h-0 gap-2">
                    {error && <ErrorBanner error={error} />}
                    {form(true)}
                </SettingsPanelContent>
            </form>
        </Form>
    )
}

export default SettingsRecordEditor
