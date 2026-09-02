import { useFormContext } from "react-hook-form"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import _ from "@lib/translate"

/** API Docs tab of the Raven Bot editor. */
const AgentApiDocsTab = () => {
    const { getValues } = useFormContext<RavenBot>()

    const botID = getValues("name")

    const botVarName = botID.replace(/[^a-zA-Z0-9_]/g, "_")

    const codeSamples = {
        sendMessage: `${botVarName} = frappe.get_doc("Raven Bot", "${botID}")

# Send a message to a channel. Text can be in HTML format.
${botVarName}.send_message(channel_id="channel-name", text="This is a test message.")`,

        sendMessageInMarkdown: `${botVarName}.send_message(
        channel_id="channel-name", 
        text="This is a test message.", 
        markdown=True
    )`,

        sendMessageWithDocumentLink: `${botVarName}.send_message(
            channel_id="channel-name", 
            text="This is a test message.", 
            link_doctype="DocType",
            link_document="Document Name"
        )`,

        sendDirectMessage: `${botVarName}.send_direct_message(
            user_id="john.doe@example.com", 
            text="This is a test message."
        )`,
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-base text-ink-gray-8">
                {_("The following code samples show how to use the bot/agent in a Frappe app or Server Script.")}
            </p>

            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{_("Sending a message to a channel")}</h3>
                <p className="text-p-sm text-ink-gray-6">
                    {_("Bots can be used to send messages to channels with HTML formatted content.")}
                </p>
                <CodeBlock sample={codeSamples.sendMessage} />
            </div>

            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{_("Sending a message to a channel in markdown format")}</h3>
                <p className="text-p-sm text-ink-gray-6">
                    {_("You can send markdown formatted text to a channel by setting the")}{" "}
                    <code className="rounded bg-surface-gray-2 px-1 py-0.5 font-mono text-p-xs">markdown</code>{" "}
                    {_("parameter to True.")}
                </p>
                <CodeBlock sample={codeSamples.sendMessageInMarkdown} />
            </div>

            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{_("Sending a message with a document link")}</h3>
                <p className="text-p-sm text-ink-gray-6">
                    {_("You can send a message with a link to any document in the system by setting the")}{" "}
                    <code className="rounded bg-surface-gray-2 px-1 py-0.5 font-mono text-p-xs">link_doctype</code>{" "}
                    {_("and")}{" "}
                    <code className="rounded bg-surface-gray-2 px-1 py-0.5 font-mono text-p-xs">link_document</code>{" "}
                    {_("parameters.")}
                </p>
                <CodeBlock sample={codeSamples.sendMessageWithDocumentLink} />
            </div>

            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{_("Sending a direct message to a user")}</h3>
                <p className="text-p-sm text-ink-gray-6">
                    {_("You can send a direct message to a user by calling the")}{" "}
                    <code className="rounded bg-surface-gray-2 px-1 py-0.5 font-mono text-p-xs">send_direct_message</code>{" "}
                    {_("method and setting the user_id parameter. This method also accepts markdown and document link parameters.")}
                </p>
                <CodeBlock sample={codeSamples.sendDirectMessage} />
            </div>
        </div>
    )
}

/** Monospace block for the un-translated Python samples. */
const CodeBlock = ({ sample }: { sample: string }) => (
    <pre className="overflow-x-auto rounded-md border border-outline-gray-2 bg-surface-gray-1 p-3 font-mono text-sm">
        <code>{sample}</code>
    </pre>
)

export default AgentApiDocsTab
