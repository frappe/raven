import { useMemo, useState } from "react"
import { CopyIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@components/ui/badge"
import { Input } from "@components/ui/input"
import { Button } from "@components/ui/button"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@components/ui/table"
import useDoctypeMeta from "@hooks/useDoctypeMeta"
import _ from "@lib/translate"

/** DocType fieldtypes that can be referenced as a Jinja variable in a notification. */
export const VARIABLE_FIELD_TYPES = [
    "Data", "Small Text", "Long Text", "Text", "Select", "Link", "Autocomplete",
    "Int", "Float", "Currency", "Percent", "Check", "Date", "Datetime", "Time",
    "Read Only", "Text Editor", "Code",
]

type Variable = { variable: string; label: string; fieldtype: string }

/**
 * A searchable table of `doc.<fieldname>` variables from the selected DocType.
 * Click a row (or its copy button) to copy the Jinja variable to the clipboard.
 * `withoutJinja` copies the bare `doc.x` (for the Condition expression) rather
 * than a `{{ doc.x }}` tag (for the message body).
 */
export const DoctypeVariables = ({ doctype, withoutJinja }: { doctype: string; withoutJinja?: boolean }) => {
    const { doc } = useDoctypeMeta(doctype)
    const [search, setSearch] = useState("")

    const variables = useMemo<Variable[]>(() => {
        if (!doc) return []
        const term = search.toLowerCase()
        return (doc.fields ?? [])
            .filter((f) =>
                f.fieldtype && VARIABLE_FIELD_TYPES.includes(f.fieldtype) &&
                f.fieldname && (f.label ?? "").toLowerCase().includes(term),
            )
            .map((f) => ({ variable: `doc.${f.fieldname}`, label: f.label ?? "", fieldtype: f.fieldtype ?? "" }))
    }, [doc, search])

    const copy = (variable: string) => {
        const text = withoutJinja ? variable : `{{ ${variable} }}`
        navigator.clipboard.writeText(text)
        toast.success(_("Copied {0}", [text]))
    }

    if (!doc) return null

    return (
        <div className="flex flex-col gap-2">
            <p className="text-p-sm text-ink-gray-5">
                {_("Variables you can use — click to copy.")}
            </p>
            <div className="relative max-w-xs">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-gray-4" aria-hidden />
                <Input inputSize="sm" className="pl-9" placeholder={_("Search")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{_("Variable")}</TableHead>
                        <TableHead>{_("Description")}</TableHead>
                        <TableHead className="w-12" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {variables.map((v) => (
                        <TableRow key={v.variable} className="cursor-pointer" onClick={() => copy(v.variable)}>
                            <TableCell><code className="text-p-sm text-ink-gray-7">{v.variable}</code></TableCell>
                            <TableCell>
                                <span className="text-ink-gray-6">{v.label}</span>
                                <Badge variant="subtle" className="ml-2">{v.fieldtype}</Badge>
                            </TableCell>
                            <TableCell>
                                <Button
                                    type="button" variant="ghost" size="sm" isIconButton
                                    aria-label={_("Copy variable")}
                                    onClick={(e) => { e.stopPropagation(); copy(v.variable) }}
                                >
                                    <CopyIcon className="text-ink-gray-6" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

export default DoctypeVariables
