import { PropsWithChildren } from "react"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { AlertCircleIcon } from "lucide-react"

export const ErrorCallout = ({ children, title }: PropsWithChildren<{ title?: string }>) => {
    return (
        <Alert theme="red">
            <AlertCircleIcon />
            {title && <AlertTitle>
                {title}
            </AlertTitle>}
            <AlertDescription>{children}</AlertDescription>
        </Alert>
    )
}