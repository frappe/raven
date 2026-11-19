import { DataField } from "@components/ui/form-elements"
import { AdminSettingsForm } from "./AdminSettingsForm"
import _ from "@lib/translate"

const FORM_ID = "settings-gifs-form"

/** The KLIPY key turns GIFs on. Boot carries it, so the GIF button follows a change on the next load. */
export const Gifs = () => (
    <AdminSettingsForm
        title={_("GIFs")}
        description={_("Let people search and send GIFs from KLIPY.")}
        formId={FORM_ID}
    >
        <DataField
            name="klipy_api_key"
            label={_("KLIPY API Key")}
            formDescription={
                <>
                    {_("Get a key from the")}{" "}
                    <a href="https://partner.klipy.com" target="_blank" rel="noreferrer" className="text-ink-blue-link underline">
                        {_("KLIPY Partner Panel")}
                    </a>
                    {". "}
                    {_("Leave it empty to turn GIFs off.")}
                </>
            }
            inputProps={{ autoComplete: "off", spellCheck: false }}
        />
    </AdminSettingsForm>
)

export default Gifs
