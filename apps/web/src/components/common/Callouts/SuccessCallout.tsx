import { PropsWithChildren } from "react";
import { CheckCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert";

export const SuccessCallout = ({ children, title }: PropsWithChildren<{ title?: string }>) => {
    return (
        <Alert theme="green">
            <CheckCircleIcon />
            {title && <AlertTitle>
                {title}
            </AlertTitle>}
            <AlertDescription>{children}</AlertDescription>
        </Alert>
    )
}