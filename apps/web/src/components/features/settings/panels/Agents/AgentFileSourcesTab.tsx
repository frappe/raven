import { useMemo, useState } from "react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { useFrappeGetDocList } from "frappe-react-sdk"
import { Trash2Icon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Checkbox } from "@components/ui/checkbox"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import ErrorBanner from "@components/ui/error-banner"
import { Skeleton } from "@components/ui/skeleton"
import FileSourceUploadDialog from "../FileSources/FileSourceUploadDialog"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import type { RavenAIFileSource } from "@raven/types/RavenAI/RavenAIFileSource"
import _ from "@lib/translate"

/** Files tab of the Raven Bot editor. */
const AgentFileSourcesTab = () => {
    const { control } = useFormContext<RavenBot>()
    const { fields, append, remove } = useFieldArray({ control, name: "file_sources" })
    const [selectOpen, setSelectOpen] = useState(false)

    // One list fetch for all attached rows instead of a get_value call per row.
    const ids = fields.map((field) => field.file).sort()
    const { data: fileSources } = useFrappeGetDocList<RavenAIFileSource>(
        "Raven AI File Source",
        {
            fields: ["name", "file_name", "file_type", "file"],
            filters: [["name", "in", ids]],
            limit: 0, // frappe-react-sdk drops a falsy limit → no cap
        },
        ids.length ? `agent-file-sources-${ids.join(",")}` : null,
        { revalidateOnFocus: false },
    )
    const fileSourcesByName = useMemo(
        () => new Map(fileSources?.map((fileSource) => [fileSource.name, fileSource] as const)),
        [fileSources],
    )

    const addNew = (ids: string[]) => {
        //@ts-expect-error - append accepts a partial row; the rest are server-set defaults
        ids.forEach((id) => append({ file: id }))
        setSelectOpen(false)
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <p className="text-p-sm text-ink-gray-6">
                    {_("Files like manuals, sheets etc can be added to the AI agent as instructions.")}
                </p>
                <div className="flex items-center gap-2">
                    <FileSourceUploadDialog
                        //@ts-expect-error - append accepts a partial row; the rest are server-set defaults
                        onUpload={(id) => append({ file: id })}
                        trigger={
                            <Button variant="subtle" size="sm" type="button">
                                {_("Upload")}
                            </Button>
                        }
                    />
                    <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" type="button" variant="subtle">
                                {_("Select Files")}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{_("Select Files")}</DialogTitle>
                                <DialogDescription>{_("Select files from the list below.")}</DialogDescription>
                            </DialogHeader>
                            <SelectExistingFiles existingFiles={fields.map((field) => field.file)} onAdd={addNew} />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {fields.length === 0 ? (
                <p className="rounded-md border border-dashed border-outline-gray-2 px-3 py-6 text-center text-p-sm text-ink-gray-5">
                    {_("No files attached yet. Upload a file or select one from your file sources.")}
                </p>
            ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{_("Name")}</TableHead>
                        <TableHead>{_("Type")}</TableHead>
                        <TableHead className="w-12" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {fields.map((field, index) => (
                        <FileSourceRow key={field.id} file={fileSourcesByName.get(field.file)} onDelete={() => remove(index)} />
                    ))}
                </TableBody>
            </Table>
            )}
        </div>
    )
}

/** One attached file row — display values come from the parent's single list fetch. */
const FileSourceRow = ({ file, onDelete }: { file?: RavenAIFileSource; onDelete: () => void }) => {
    return (
        <TableRow>
            <TableCell className="max-w-[250px] md:text-sm">
                <a
                    href={file?.file}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-ink-gray-8 underline underline-offset-2 hover:text-ink-gray-10"
                >
                    {file?.file_name}
                </a>
            </TableCell>
            <TableCell className="max-w-[250px] md:text-sm">
                {file?.file_type && (
                    <Badge variant="subtle" theme="gray" className="uppercase">
                        {file.file_type}
                    </Badge>
                )}
            </TableCell>
            <TableCell className="w-12 text-right">
                <Button
                    variant="ghost"
                    theme="red"
                    size="sm"
                    isIconButton
                    type="button"
                    title={_("Delete")}
                    aria-label={_("Delete")}
                    onClick={onDelete}
                >
                    <Trash2Icon />
                </Button>
            </TableCell>
        </TableRow>
    )
}

/** Pick existing Raven AI File Sources via checkboxes, then append them all at once. */
const SelectExistingFiles = ({ existingFiles, onAdd }: { existingFiles: string[]; onAdd: (ids: string[]) => void }) => {
    const [selectedFiles, setSelectedFiles] = useState<string[]>([])

    const { data, isLoading, error } = useFrappeGetDocList<RavenAIFileSource>(
        "Raven AI File Source",
        {
            fields: ["name", "file_name", "file_type", "file"],
            limit: 0, // frappe-react-sdk drops a falsy limit → no cap
        },
        "agent-select-file-sources",
        { revalidateOnFocus: false },
    )

    const onSelect = (id: string) => {
        setSelectedFiles((prev) => (prev.includes(id) ? prev.filter((fileID) => fileID !== id) : [...prev, id]))
    }

    const availableFiles = data?.filter((fileSource) => !existingFiles.includes(fileSource.name)) ?? []

    return (
        <div className="flex flex-col gap-3">
            {isLoading && <Skeleton className="h-10 w-full" />}
            {error && <ErrorBanner error={error} />}

            {!isLoading && availableFiles.length === 0 ? (
                <p className="rounded-md border border-dashed border-outline-gray-2 px-3 py-6 text-center text-p-sm text-ink-gray-5">
                    {_("No more file sources to add.")}
                </p>
            ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{_("Name")}</TableHead>
                        <TableHead>{_("Type")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {availableFiles.map((fileSource) => (
                        <TableRow key={fileSource.name}>
                            <TableCell className="max-w-[300px] md:text-sm">
                                <label className="flex cursor-pointer items-center gap-2">
                                    <Checkbox
                                        checked={selectedFiles.includes(fileSource.name)}
                                        onCheckedChange={() => onSelect(fileSource.name)}
                                    />
                                    <span className="truncate text-base text-ink-gray-8 md:text-sm">{fileSource.file_name}</span>
                                </label>
                            </TableCell>
                            <TableCell className="max-w-[250px] md:text-sm">
                                {fileSource.file_type && (
                                    <Badge variant="subtle" theme="gray" className="uppercase">
                                        {fileSource.file_type}
                                    </Badge>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            )}

            <DialogFooter className="flex-row justify-end gap-2">
                <DialogClose asChild>
                    <Button variant="outline" size="md" type="button">
                        {_("Close")}
                    </Button>
                </DialogClose>
                <Button size="md" type="button" disabled={selectedFiles.length === 0} onClick={() => onAdd(selectedFiles)}>
                    {_("Add")}
                </Button>
            </DialogFooter>
        </div>
    )
}

export default AgentFileSourcesTab
