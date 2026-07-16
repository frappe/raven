import { getErrorMessages } from '@lib/frappe'
import { FrappeError } from 'frappe-react-sdk'
import { Alert, AlertDescription, AlertProps, AlertTitle } from '@components/ui/alert'
import { AlertCircle } from 'lucide-react'
import MarkdownRenderer from '@components/ui/markdown'
import _ from '@lib/translate'
import { ReactNode, useMemo } from 'react'
import { toast, type ExternalToast } from 'sonner'

type ErrorBannerProps = AlertProps & {
    error?: FrappeError | null,
    overrideHeading?: string,
}

interface ParsedErrorMessage {
    message: string,
    title?: string,
    indicator?: string,
}

const parseHeading = (message?: ParsedErrorMessage) => {
    if (message?.title === 'Message' || message?.title === 'Error') return "There was an error."
    return message?.title
}

const ErrorBanner = ({ error, overrideHeading, ...props }: ErrorBannerProps) => {


    //exc_type: "ValidationError" or "PermissionError" etc
    // exc: With entire traceback - useful for reporting maybe
    // httpStatus and httpStatusText - not needed
    // _server_messages: Array of messages - useful for showing to user
    // console.log(JSON.parse(error?._server_messages!))

    const { heading, descriptions, theme }:
        { heading: string, descriptions: string[], theme: AlertProps['theme'] } = useMemo(() => {

            const messages = getErrorMessages(error)

            const theme = messages[0]?.indicator === 'yellow' ? 'amber' : "red"

            let heading = "There was an error."

            let descriptions: string[] = []

            if (overrideHeading) {
                heading = overrideHeading
            }
            // If there's a generic error, then use the first message as the heading, and description will be the rest of the messages
            if (!overrideHeading && (messages[0]?.title === 'Message' || messages[0]?.title === 'Error')) {
                heading = messages[0]?.message
                descriptions = messages.slice(1).map((m) => m.message)
            } else {
                // Else if there's a title, then use it as the heading and all message descriptions are added
                heading = messages[0]?.title ?? "There was an error."
                descriptions = messages.map((m) => m.message)
            }
            return {
                theme,
                heading,
                descriptions

            }

        }, [overrideHeading])

    return (
        <Alert theme={theme} {...props}>
            <AlertCircle />
            <AlertTitle><MarkdownRenderer content={heading} /></AlertTitle>
            {descriptions.length > 0 && <AlertDescription>
                {descriptions.map((d, i) => <MarkdownRenderer content={d} key={i} />)}
            </AlertDescription>}
        </Alert>
    )
}

export const errorResponseToast = (title: string, error?: FrappeError | null, options?: ExternalToast) => {
    toast.error(title, {
        description: getErrorMessageAsMarkdown(error),
        ...options,
    })
}

export const getErrorMessageAsMarkdown = (error?: FrappeError | null): ReactNode => {
    const messages = getErrorMessages(error)
    return <>
        {messages.map((m, i) => {
            return <MarkdownRenderer content={m.message} key={i} />
        })}
    </>
}

export default ErrorBanner