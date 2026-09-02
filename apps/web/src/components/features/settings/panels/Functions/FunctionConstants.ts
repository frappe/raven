export const FUNCTION_TYPES = [
    {
        value: "Get Document",
        description: "Fetch any document from the system.",
        requires_write_permissions: false,
        type: "Standard"
    },
    {
        value: "Get Multiple Documents",
        description: "Fetch multiple document from the system",
        requires_write_permissions: false,
        type: "Bulk Operations"
    },
    {
        value: "Get List",
        description: "Fetch a list of documents from the system (using filters).",
        requires_write_permissions: false,
        type: "Standard"
    },
    {
        value: "Get Value",
        description: "Get a single value or multiple values from a document in the system using filters.",
        requires_write_permissions: false,
        type: "Standard"
    },
    {
        value: "Set Value",
        description: "Set a value in a document in the system. This function can set a single value or multiple values in a document.",
        requires_write_permissions: true,
        type: "Standard"
    },
    {
        value: "Create Document",
        description: "Create any document in the system.",
        requires_write_permissions: true,
        type: "Standard"
    },
    {
        value: "Create Multiple Documents",
        description: "Create multiple documents in the system in one go.",
        requires_write_permissions: true,
        type: "Bulk Operations"
    },
    {
        value: "Update Document",
        description: "Update any document in the system.",
        requires_write_permissions: true,
        type: "Standard"
    },
    {
        value: "Update Multiple Documents",
        description: "Update multiple documents in the system in one go.",
        requires_write_permissions: true,
        type: "Bulk Operations"
    },
    {
        value: "Delete Document",
        description: "Delete any document in the system.",
        requires_write_permissions: true,
        type: "Standard"
    },
    {
        value: "Delete Multiple Documents",
        description: "Delete multiple documents in the system in one go.",
        requires_write_permissions: true,
        type: "Bulk Operations"
    },
    {
        value: "Submit Document",
        description: "Submit any document in the system.",
        requires_write_permissions: true,
        type: "Standard"
    },
    {
        value: "Cancel Document",
        description: "Cancel any document in the system.",
        requires_write_permissions: true,
        type: "Standard"
    },
    {
        value: "Get Amended Document",
        description: "Get the amended document for a given document. This function is only available for documents that have been cancelled and then amended.",
        requires_write_permissions: false,
        type: "Standard"
    },
    {
        value: "Custom Function",
        description: "Custom function to be used in the system.",
        type: "Other"
    },
    {
        value: "Attach File to Document",
        description: "Attach a file to any document.",
        requires_write_permissions: true,
        type: "Other"
    },
    {
        value: "Get Report Result",
        description: "Allows the bot to get the result of any report in the system.",
        requires_write_permissions: false,
        type: "Other"
    },
]

export type VariableType = StringVariableType | NumberVariableType | BooleanVariableType | ObjectVariableType | ArrayVariableType

export interface BaseVariableType {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
    description?: string

}

export interface StringVariableType extends BaseVariableType {
    type: 'string',
    enum?: string[],
}

export interface NumberVariableType extends BaseVariableType {
    type: 'number',
    enum?: string[]
}

interface BooleanVariableType extends BaseVariableType {
    type: 'boolean'
}


export interface ObjectVariableType extends BaseVariableType {
    type: 'object'
    properties: Record<string, VariableType>,
    required?: string[]
}

export interface ArrayVariableType extends BaseVariableType {
    type: 'array'
    items: StringVariableType | NumberVariableType,
    minItems?: number
}
