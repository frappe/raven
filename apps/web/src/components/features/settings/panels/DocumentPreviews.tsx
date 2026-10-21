import { useDeferredValue, useMemo, useState } from "react"
import { useFrappeGetDocList, useFrappePostCall, useSWRConfig } from "frappe-react-sdk"
import { toast } from "sonner"
import { SearchIcon } from "lucide-react"
import { Alert, AlertDescription } from "@components/ui/alert"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Checkbox } from "@components/ui/checkbox"
import ErrorBanner from "@components/ui/error-banner"
import { Input } from "@components/ui/input"
import {
    SettingsPanelContent, SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { Spinner } from "@components/ui/spinner"
import LinkFieldCombobox from "@components/common/LinkFieldComboBox/LinkFieldCombobox"
import { DocumentLinkRenderer, documentPreviewSwrKey } from "@components/features/message/renderers/DocumentLinkRenderer"
import useDoctypeMetaDocs from "@hooks/useDoctypeMetaDocs"
import type { DocField } from "@raven/types/Core/DocField"
import { hasRole } from "@lib/permissions"
import _ from "@lib/translate"

/** Field types with no value to show in a preview card. */
const NO_VALUE_FIELDS = new Set([
    "Section Break", "Column Break", "Tab Break", "HTML", "Table", "Table MultiSelect", "Button", "Image", "Fold", "Heading",
])

/**
 * Integrations → Document Previews: pick which fields a doctype shows when a
 * document link is previewed in chat. Left: choose a doctype and tick fields.
 * Right: a live preview card for a document of that doctype.
 */
export const DocumentPreviews = () => {
    const [doctype, setDoctype] = useState("")
    const [docname, setDocname] = useState("")
    const canEdit = hasRole("System Manager")

    return (
        <>
            <SettingsPanelHeader>
                <SettingsPanelTitle>{_("Document Previews")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Customise how document links are displayed in the chat. You can add/remove fields to be displayed in the preview.")}
                </SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-4">
                {!canEdit && (
                    <Alert theme="gray">
                        <AlertDescription>{_("You need the System Manager role to change document previews.")}</AlertDescription>
                    </Alert>
                )}
                <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-2">
                    <div className="flex min-h-0 min-w-0 flex-col gap-3">
                        <h3 className="text-base font-medium text-ink-gray-8">{_("Configure")}</h3>
                        <LinkFieldCombobox
                            doctype="DocType"
                            filters={[["issingle", "=", 0], ["istable", "=", 0]]}
                            value={doctype}
                            onChange={(value) => { setDoctype(value); setDocname("") }}
                            placeholder={_("Select a DocType")}
                        />
                        {doctype && <PreviewFields key={doctype} doctype={doctype} docname={docname} canEdit={canEdit} />}
                    </div>
                    {doctype && (
                        <div className="flex min-w-0 flex-col gap-3">
                            <h3 className="text-base font-medium text-ink-gray-8">{_("Preview")}</h3>
                            <DocumentPreview doctype={doctype} docname={docname} onDocnameChange={setDocname} />
                        </div>
                    )}
                </div>
            </SettingsPanelContent>
        </>
    )
}

/** Loads the doctype's meta, then hands the eligible and current preview fields to the editor. */
const PreviewFields = ({ doctype, docname, canEdit }: { doctype: string; docname: string; canEdit: boolean }) => {
    const { doc, mutate } = useDoctypeMetaDocs(doctype)

    const { eligibleFields, previewFields } = useMemo(() => {
        const eligibleFields = doc?.fields?.filter((f) => f.fieldname && !NO_VALUE_FIELDS.has(f.fieldtype)) ?? []
        const previewFields = eligibleFields.filter((f) => f.in_preview).map((f) => f.fieldname as string)
        return { eligibleFields, previewFields }
    }, [doc])

    if (!doc) {
        return (
            <div className="flex h-24 items-center justify-center">
                <Spinner />
            </div>
        )
    }
    return (
        <PreviewFieldsEditor
            doctype={doctype}
            docname={docname}
            eligibleFields={eligibleFields}
            previewFields={previewFields}
            canEdit={canEdit}
            onSaved={() => mutate()}
        />
    )
}

const PreviewFieldsEditor = ({
    doctype, docname, eligibleFields, previewFields, canEdit, onSaved,
}: {
    doctype: string
    docname: string
    eligibleFields: DocField[]
    previewFields: string[]
    canEdit: boolean
    onSaved: () => void
}) => {
    const [selected, setSelected] = useState<string[]>(previewFields)
    const [search, setSearch] = useState("")
    const query = useDeferredValue(search.trim().toLowerCase())

    const visibleFields = useMemo(
        () => (query
            ? eligibleFields.filter((f) => f.fieldname?.toLowerCase().includes(query) || f.label?.toLowerCase().includes(query))
            : eligibleFields),
        [eligibleFields, query],
    )

    // Compared against the saved set, so a successful save clears this on its own once the meta refreshes.
    const hasChanges = selected.length !== previewFields.length || selected.some((f) => !previewFields.includes(f))

    const { mutate: globalMutate } = useSWRConfig()
    const { call, loading, error } = useFrappePostCall("raven.api.document_link.update_preview_fields")

    const save = () => {
        call({ doctype, fields: selected })
            .then(() => {
                toast.success(_("Fields updated"), {
                    id: "preview-field-updated"
                })
                onSaved()
                // The card renderer caches meta and preview data under its own keys.
                globalMutate(`doctype_meta::${doctype}`)
                if (docname) globalMutate(documentPreviewSwrKey(doctype, docname))
            })
            .catch(() => { /* surfaced by the error banner */ })
    }

    const toggle = (fieldname: string, checked: boolean) => {
        setSelected((prev) => (checked ? [...prev, fieldname] : prev.filter((f) => f !== fieldname)))
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            {previewFields.length === 0 && (
                <p className="text-p-sm text-ink-gray-6">
                    {_("No fields are selected for preview, so all mandatory fields of {0} are shown.", [doctype])}
                </p>
            )}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-gray-4" aria-hidden="true" />
                    <Input
                        inputSize="sm"
                        type="search"
                        className="pl-9"
                        placeholder={_("Search fields")}
                        aria-label={_("Search fields")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button type="button" size="sm" onClick={save} disabled={!canEdit || !hasChanges} loading={loading} loadingText={_("Updating")}>
                    {_("Update")}
                </Button>
            </div>
            {error && <ErrorBanner error={error} />}
            <div className="scroll-fade flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto -mx-2 pb-3">
                {visibleFields.length === 0 && (
                    <p className="px-2 py-1.5 text-p-sm text-ink-gray-5">{_("No fields match your search.")}</p>
                )}
                {visibleFields.map((field) => (
                    <label
                        key={field.fieldname}
                        className="relative flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-gray-2 has-[:disabled]:cursor-not-allowed"
                    >
                        <Checkbox
                            checked={selected.includes(field.fieldname as string)}
                            disabled={!canEdit || loading}
                            onCheckedChange={(v) => toggle(field.fieldname as string, v === true)}
                        />
                        <span className="min-w-0 flex-1 truncate text-p-sm text-ink-gray-8">{field.label || field.fieldname}</span>
                        <Badge variant="subtle" className="shrink-0">{field.fieldtype}</Badge>
                    </label>
                ))}
            </div>
        </div>
    )
}

/** Picks a document to preview. Starts on the most recently changed one so the card shows up right away. */
const DocumentPreview = ({
    doctype, docname, onDocnameChange,
}: { doctype: string; docname: string; onDocnameChange: (docname: string) => void }) => {
    const { data: latest } = useFrappeGetDocList<{ name: string }>(
        doctype,
        { fields: ["name"], orderBy: { field: "modified", order: "desc" }, limit: 1 },
        `document-preview-latest::${doctype}`,
        { revalidateOnFocus: false },
    )
    const previewDocname = docname || latest?.[0]?.name || ""

    return (
        <>
            <LinkFieldCombobox
                doctype={doctype}
                value={previewDocname}
                onChange={onDocnameChange}
                placeholder={_("Select a document")}
            />
            {previewDocname && <DocumentLinkRenderer doctype={doctype} docname={previewDocname} className="max-w-full" />}
        </>
    )
}

export default DocumentPreviews
