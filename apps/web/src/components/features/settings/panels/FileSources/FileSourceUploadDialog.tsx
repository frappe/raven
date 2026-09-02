import { Button } from "@components/ui/button"
import { DataField } from "@components/ui/form-elements"
import UploadDocDialog from "@components/common/UploadDocDialog"
import type { RavenAIFileSource } from "@raven/types/RavenAI/RavenAIFileSource"
import _ from "@lib/translate"

type FileSourceUploadDialogProps = {
    /** Called with the new doc name once upload + create succeed. */
    onUpload: (id: string) => void | Promise<void>
    /** Custom dialog trigger. Defaults to a primary "Upload" button. */
    trigger?: React.ReactNode
}

/** Upload a file as a Raven AI File Source. Also reused by the Agents panel to attach files to an agent. */
export const FileSourceUploadDialog = ({ onUpload, trigger }: FileSourceUploadDialogProps) => (
    <UploadDocDialog<RavenAIFileSource>
        doctype="Raven AI File Source"
        fileField="file"
        isPrivate
        maxBytes={10 * 1024 * 1024}
        title={_("Upload File")}
        description={_("Upload a file to use as a data source for AI Agents.")}
        submitLabel={_("Upload")}
        submitBusyLabel={_("Uploading...")}
        defaults={{ file_name: "" }}
        docname={() => `new-raven-ai-file-source-${Date.now()}`}
        onFilePicked={(file, form) =>
            form.setValue("file_name", file ? file.name.split(".").slice(0, -1).join(".") || file.name : "")
        }
        onCreated={(doc) => onUpload(doc.name)}
        trigger={trigger ?? <Button type="button" size="sm">{_("Upload")}</Button>}
    >
        <DataField
            name="file_name"
            label={_("File Name")}
            isRequired
            rules={{ required: _("File name is required") }}
        />
    </UploadDocDialog>
)

export default FileSourceUploadDialog
