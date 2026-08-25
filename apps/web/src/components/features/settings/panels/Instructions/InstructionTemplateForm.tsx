import { DataField } from "@components/ui/form-elements"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import InstructionField from "../ai/InstructionField"
import _ from "@lib/translate"

/** Form fields for an instruction template — rendered inside the editor's FormProvider. */
const InstructionTemplateForm = ({ isEdit }: { isEdit?: boolean }) => (
    <>
        <AINotEnabledCallout />
        <div className="md:w-1/2">
            <DataField
                name="template_name"
                label={_("Template Name")}
                isRequired
                rules={{ required: _("Name is required") }}
                inputProps={{ placeholder: _("Create Document Template") }}
                readOnly={isEdit}
            />
        </div>
        <InstructionField instructionRequired autoFocus={!isEdit} />
    </>
)

export default InstructionTemplateForm
