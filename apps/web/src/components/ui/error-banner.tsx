import { getErrorMessages } from '@lib/frappe'
import { cn } from '@lib/utils'
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
    /**
     * "banner" (default): the classic inline alert.
     * "centered": a vertical, centered block for full-panel error states —
     * icon on top, heading, messages, then `children` (e.g. a Retry button).
     */
    layout?: "banner" | "centered",
    /** Rendered after the messages — the action slot (Retry etc.). */
    children?: ReactNode,
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

const ErrorBanner = ({ error, overrideHeading, layout = "banner", children, className, ...props }: ErrorBannerProps) => {


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

            // If there's a generic error, then use the first message as the heading, and description will be the rest of the messages
            if (!overrideHeading && (messages[0]?.title === 'Message' || messages[0]?.title === 'Error')) {
                heading = messages[0]?.message
                descriptions = messages.slice(1).map((m) => m.message)
            } else {
                // Else use the override or the first message's title as the
                // heading, and all messages as descriptions.
                heading = overrideHeading ?? messages[0]?.title ?? "There was an error."
                descriptions = messages.map((m) => m.message)
            }

            // No parsed server messages (network failure, plain HTTP error):
            // fall back to the error's own message so the banner still says
            // something useful — unless it already IS the heading.
            if (descriptions.length === 0 && error?.message && error.message !== heading) {
                descriptions = [error.message]
            }

            return {
                theme,
                heading,
                descriptions

            }

        }, [error, overrideHeading])

    if (layout === "centered") {
        const isAmber = theme === 'amber'
        return (
            <div className={cn("flex flex-col items-center gap-3 p-6 text-center", className)} role="alert">
                <span className={cn(
                    "flex size-10 items-center justify-center rounded-full",
                    isAmber ? "bg-surface-amber-2 text-ink-amber-8" : "bg-surface-red-2 text-ink-red-8",
                )}>
                    <AlertCircle className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                    <div className="text-base-medium text-ink-gray-9"><MarkdownRenderer content={heading} /></div>
                    {descriptions.map((d, i) => (
                        <div className="text-p-sm text-ink-gray-6" key={i}><MarkdownRenderer content={d} /></div>
                    ))}
                </div>
                {children}
            </div>
        )
    }

    return (
        <Alert theme={theme} className={className} {...props}>
            <AlertCircle />
            <AlertTitle><MarkdownRenderer content={heading} /></AlertTitle>
            {descriptions.length > 0 && <AlertDescription>
                {descriptions.map((d, i) => <MarkdownRenderer content={d} key={i} />)}
            </AlertDescription>}
            {children}
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