import { Badge } from "@components/ui/badge"
import _ from "@lib/translate"

type BadgeTheme = "gray" | "blue" | "green" | "amber" | "red" | "violet"

/** Maps a field type onto the label and v3 Badge theme shown next to it. */
export const getFieldTypeBadge = (
    type: string,
): { label: string; theme: BadgeTheme } => {
    switch (type) {
        case "integer":
            return { label: "Integer", theme: "blue" }
        case "number":
            return { label: "Number", theme: "violet" }
        case "float":
            return { label: "Float", theme: "violet" }
        case "string":
            return { label: "String", theme: "green" }
        case "boolean":
            return { label: "Boolean", theme: "red" }
        case "object":
            return { label: "Object", theme: "amber" }
        case "array":
            return { label: "Array", theme: "blue" }
        case "null":
            return { label: "Null", theme: "gray" }
        default:
            return { label: type, theme: "gray" }
    }
}

export const FieldTypeBadge = ({ type }: { type: string }) => {
    const { label, theme } = getFieldTypeBadge(type)
    return (
        <Badge variant="subtle" theme={theme}>
            {_(label)}
        </Badge>
    )
}

export default FieldTypeBadge
