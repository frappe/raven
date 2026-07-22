
export interface TriggerEventField {
    key: string,
    label: string,
    doctype: string,
    event: "after_insert" | "on_update" | "on_submit" | "on_cancel" | "on_trash" | "on_update_after_submit" | "on_change",
    trigger_on: string[]
}

export const TriggerEvents: TriggerEventField[] = [
    {
        key: 'message_sent',
        label: 'Message Sent',
        doctype: 'Raven Message',
        event: 'after_insert',
        trigger_on: ['Channel', 'User', 'Channel Type']
    },
    {
        key: 'message_edited',
        label: 'Message Edited',
        doctype: 'Raven Message',
        event: 'on_update',
        trigger_on: ['Channel', 'User', 'Channel Type']
    },
    {
        key: 'message_deleted',
        label: 'Message Deleted',
        doctype: 'Raven Message',
        event: 'on_trash',
        trigger_on: ['Channel', 'User', 'Channel Type']
    },
    {
        key: 'emoji_reaction',
        label: 'Message Reacted On',
        doctype: 'Raven Message Reaction',
        event: 'after_insert',
        trigger_on: ['Channel', 'User', 'Channel Type']
    },
    {
        key: 'channel_created',
        label: 'Channel Created',
        doctype: 'Raven Channel',
        event: 'after_insert',
        trigger_on: ['User', 'Channel_Type']
    },
    {
        key: 'channel_deleted',
        label: 'Channel Deleted',
        doctype: 'Raven Channel',
        event: 'on_trash',
        trigger_on: ['User', 'Channel_Type']
    },
    {
        key: 'channel_member_added',
        label: 'Channel Member Added',
        doctype: 'Raven Channel Member',
        event: 'after_insert',
        trigger_on: ['Channel', 'User', 'Channel Type']
    },
    {
        key: 'channel_member_deleted',
        label: 'Channel Member Deleted',
        doctype: 'Raven Channel Member',
        event: 'on_trash',
        trigger_on: ['Channel', 'User', 'Channel Type']
    },
    {
        key: 'raven_user_added',
        label: 'User Added',
        doctype: 'Raven User',
        event: 'after_insert',
        trigger_on: ['User']
    },
    {
        key: 'raven_user_deleted',
        label: 'User Deleted',
        doctype: 'Raven User',
        event: 'on_trash',
        trigger_on: ['User']
    }
]

export interface FieldsData {
    fieldname: string,
    label: string,
    fieldtype?: string,
    description?: string,
    example?: string,
}

const commonFields = [
    {
        fieldname: 'name',
        label: 'ID',
        fieldtype: 'Data',
        description: 'ID of the document'
    },
    {
        fieldname: 'creation',
        label: 'Creation Time',
        fieldtype: 'DateTime',
        description: `Time when the document was created in string format.`,
        example: '2021-08-12 12:00:00'
    },
    {
        fieldname: 'modified',
        label: 'Last Updated Time',
        fieldtype: 'DateTime',
        description: `Time when the document was last updated in string format.`,
        example: '2021-08-12 12:00:00'
    },
    {
        fieldname: 'modified_by',
        label: 'Last Updated By',
        fieldtype: 'Data',
        description: 'User ID of the person who last updated the document.',
        example: 'Administrator'
    },
    {
        fieldname: 'owner',
        label: 'Document Created By',
        fieldtype: 'Data',
        description: 'User ID of the person who created the document.',
        example: 'Administrator'
    },
]

export const DoctypeFieldList: {
    doctype: 'Raven Message' | 'Raven Channel' | 'Raven Channel Member' | 'Raven User' | 'Raven Message Reaction',
    events: string[]
    fields: FieldsData[]
}[] = [
        {
            doctype: 'Raven Message',
            events: ['Message Sent', 'Message Edited', 'Message Deleted'],
            fields: [
                {
                    fieldname: 'channel_id',
                    label: 'Channel ID',
                    fieldtype: 'Link',
                    description: 'ID of the channel where the message was sent.',
                    example: 'general'
                },
                {
                    fieldname: 'text',
                    label: 'Text',
                    fieldtype: 'Long Text',
                    description: 'Text of the message, in pure html format.',
                    example: '<p>Hello, World!</p>'
                },
                {
                    fieldname: 'json',
                    label: 'JSON',
                    fieldtype: 'JSON',
                    description: 'JSON data of the message.',
                    example: `{
                        content: [
                            {
                                content: [
                                    {
                                        text: "Hello, World!",
                                        type: "text"
                                    }
                                ],
                                type: "paragraph"
                            }
                        ],
                        type: "doc"
                    }`
                },
                {
                    fieldname: 'message_type',
                    label: 'Message Type',
                    fieldtype: 'Select',
                    description: 'Type of the message.',
                    example: 'Text or Image or File'
                },
                {
                    fieldname: 'file',
                    label: 'File',
                    fieldtype: 'Attach',
                    description: 'File attached with the message.',
                    example: 'https://example.com/file.pdf'
                },
                {
                    fieldname: 'message_reactions',
                    label: 'Message Reactions',
                    fieldtype: 'JSON',
                    description: 'Reactions on the message.',
                    example: `{
                        'unicode_string 1':{
                            'count': 1,
                            'users':['user1'],
                            'reaction': 'unicode_string 1'

                        },
                        'unicode_string 2':{
                            'count': 2,
                            'users':['user1', 'user2'],
                            'reaction': 'unicode_string 2'
                        }
                    }`
                },
                {
                    fieldname: 'is_reply',
                    label: 'Is Reply',
                    fieldtype: 'Check',
                    description: 'Whether the message is a reply to another message.',
                    example: '1 or 0'
                },
                {
                    fieldname: 'linked_message',
                    label: 'Linked Message',
                    fieldtype: 'Link',
                    description: 'ID of the message to which this message is a reply.',
                    example: 'message-id'
                },

                {
                    fieldname: 'content',
                    label: 'Content',
                    fieldtype: 'Long Text',
                    description: 'Content of the message in plain text.',
                    example: 'Hello, World!'
                },
                ...commonFields
            ]
        },
        {
            doctype: 'Raven Channel',
            events: ['Channel Created', 'Channel Deleted'],
            fields: [
                {
                    fieldname: 'channel_name',
                    label: 'Channel Name',
                    fieldtype: 'Data',
                    description: 'Name of the channel.',
                    example: 'general'
                },
                {
                    fieldname: 'channel_description',
                    label: 'Channel Description',
                    fieldtype: 'Data',
                    description: 'Description of the channel.',
                    example: 'General discussion'
                },
                {
                    fieldname: 'type',
                    label: 'Type',
                    fieldtype: 'Select',
                    description: 'Type of the channel.',
                    example: 'Public or Private or Open'
                },
                {
                    fieldname: 'is_direct_message',
                    label: 'Is Direct Message',
                    fieldtype: 'Check',
                    description: 'Whether the channel is a direct message channel.',
                    example: '1 or 0'
                },
                {
                    fieldname: 'is_self_message',
                    label: 'Is Self Message',
                    fieldtype: 'Check',
                    description: 'Whether the channel is a self message channel.',
                    example: '1 or 0'
                },
                {
                    fieldname: 'is_archived',
                    label: 'Is Archived',
                    fieldtype: 'Check',
                    description: 'Whether the channel is archived.',
                    example: '1 or 0'
                },
                ...commonFields

            ]
        },
        {
            'doctype': 'Raven Channel Member',
            events: ['Channel Member Added', 'Channel Member Deleted'],
            fields: [
                {
                    fieldname: 'channel_id',
                    label: 'Channel ID',
                    fieldtype: 'Link',
                    description: 'ID of the channel.',
                    example: 'general'
                },
                {
                    fieldname: 'user_id',
                    label: 'User ID',
                    fieldtype: 'Link',
                    description: 'ID of the user.',
                    example: 'user1'
                },
                {
                    fieldname: 'is_admin',
                    label: 'Is Admin',
                    fieldtype: 'Check',
                    description: 'Whether the user is an admin of the channel.',
                    example: '1 or 0'
                },
                {
                    fieldname: 'last_visit',
                    label: 'Last Visit',
                    fieldtype: 'Datetime',
                    description: 'Time when the user last visited the channel.',
                    example: '2021-08-12 12:00:00'
                },
                ...commonFields
            ]
        },
        {
            doctype: 'Raven User',
            events: ['User Added', 'User Deleted'],
            fields: [
                {
                    fieldname: 'user',
                    label: 'User',
                    fieldtype: 'Link',
                    description: 'User ID.',
                    example: 'user1'
                },
                {
                    fieldname: 'full_name',
                    label: 'Full Name',
                    fieldtype: 'Data',
                    description: 'Full name of the user.',
                    example: 'John Doe'
                },
                {
                    fieldname: 'first_name',
                    label: 'First Name',
                    fieldtype: 'Data',
                    description: 'First name of the user.',
                    example: 'John'
                },
                {
                    fieldname: 'user_image',
                    label: 'User Image',
                    fieldtype: 'Attach Image',
                    description: 'Image of the user.',
                    example: 'https://example.com/image.jpg'
                },
                {
                    fieldname: 'enabled',
                    label: 'Enabled',
                    fieldtype: 'Check',
                    description: 'Whether the user is enabled.',
                    example: '1 or 0'
                },
                ...commonFields
            ]
        },
        {
            doctype: 'Raven Message Reaction',
            events: ['Message Reacted On'],
            fields: [
                {
                    fieldname: 'reaction',
                    label: 'Reaction',
                    fieldtype: 'Data',
                    description: 'Reaction emoji.',
                    example: '👍'
                },
                {
                    fieldname: 'reaction_escaped',
                    label: 'Reaction Escaped',
                    fieldtype: 'Data',
                    description: 'Escaped reaction emoji.',
                    example: '\\ud83d\\udc4d'
                },
                {
                    fieldname: 'message',
                    label: 'Message',
                    fieldtype: 'Link',
                    description: 'ID of the message.',
                    example: 'message-id'
                },
                ...commonFields
            ]
        }
    ]

export const SampleData = [
    {
        trigger_event: ['Channel Created', 'Channel Deleted'],
        examples: [
            {
                name: 'general',
                fields: [
                    {
                        field: 'channel_name',
                        value: 'general'
                    },
                    {
                        field: 'channel_description',
                        value: 'General discussion'
                    },
                    {
                        field: 'type',
                        value: 'Public'
                    },
                    {
                        field: 'is_direct_message',
                        value: '0'
                    },
                    {
                        field: 'is_self_message',
                        value: '0'
                    },
                    {
                        field: 'is_archived',
                        value: '0'
                    }
                ]
            },
            {
                name: 'kings-landing',
                fields: [
                    {
                        field: 'channel_name',
                        value: 'kings-landing'
                    },
                    {
                        field: 'channel_description',
                        value: 'The capital of Westeros and the Seven Kingdoms.'
                    },
                    {
                        field: 'type',
                        value: 'Public'
                    },
                    {
                        field: 'is_direct_message',
                        value: '0'
                    },
                    {
                        field: 'is_self_message',
                        value: '0'
                    },
                    {
                        field: 'is_archived',
                        value: '0'
                    }
                ]
            },
            {
                name: 'winterfell',
                fields: [
                    {
                        field: 'channel_name',
                        value: 'winterfell'
                    },
                    {
                        field: 'channel_description',
                        value: 'The ancestral home of House Stark.'
                    },
                    {
                        field: 'type',
                        value: 'Public'
                    },
                    {
                        field: 'is_direct_message',
                        value: '0'
                    },
                    {
                        field: 'is_self_message',
                        value: '0'
                    },
                    {
                        field: 'is_archived',
                        value: '0'
                    }
                ]
            },
            {
                name: 'dragons-bay',
                fields: [
                    {
                        field: 'channel_name',
                        value: 'dragons-bay'
                    },
                    {
                        field: 'channel_description',
                        value: 'The place where dragons are born.'
                    },
                    {
                        field: 'type',
                        value: 'Public'
                    },
                    {
                        field: 'is_direct_message',
                        value: '0'
                    },
                    {
                        field: 'is_self_message',
                        value: '0'
                    },
                    {
                        field: 'is_archived',
                        value: '0'
                    }
                ]
            },
            {
                name: 'white-walkers',
                fields: [
                    {
                        field: 'channel_name',
                        value: 'white-walkers'
                    },
                    {
                        field: 'channel_description',
                        value: 'The army of the dead.'
                    },
                    {
                        field: 'type',
                        value: 'Private'
                    },
                    {
                        field: 'is_direct_message',
                        value: '0'
                    },
                    {
                        field: 'is_self_message',
                        value: '0'
                    },
                    {
                        field: 'is_archived',
                        value: '0'
                    }
                ]
            }
        ]
    },
    {
        trigger_event: ['Message Sent', 'Message Edited', 'Message Deleted'],
        examples: [
            {
                name: 'Hello, World!',
                fields: [
                    {
                        field: 'channel_id',
                        value: 'general'
                    },
                    {
                        field: 'text',
                        value: 'Hello, World!'
                    },
                    {
                        field: 'json',
                        value: `{
                            content: [
                                {
                                    content: [
                                        {
                                            text: "Hello, World!",
                                            type: "text"
                                        }
                                    ],
                                    type: "paragraph"
                                }
                            ],
                            type: "doc"
                        }`
                    },
                    {
                        field: 'message_type',
                        value: 'Text'
                    },
                    {
                        field: 'file',
                        value: 'https://ravenapp.info/_astro/app-screenshot.e5f6e34e.png'
                    },
                    {
                        field: 'message_reactions',
                        value: `{
                            'unicode_string 1':{
                                'count': 1,
                                'users':['user1'],
                                'reaction': 'unicode_string 1'
                            }
                        }`
                    },
                    {
                        field: 'is_reply',
                        value: '0'
                    },
                    {
                        field: 'linked_message',
                        value: 'message-id'
                    },
                    {
                        field: 'content',
                        value: 'Hello, World!'
                    },
                    {
                        field: 'name',
                        value: 'message-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            },
            {
                name: 'The Iron Throne is mine!',
                fields: [
                    {
                        field: 'channel_id',
                        value: 'kings-landing'
                    },
                    {
                        field: 'text',
                        value: 'The Iron Throne is mine!'
                    },
                    {
                        field: 'message_type',
                        value: 'Text'
                    },
                    {
                        field: 'is_reply',
                        value: '0'
                    },
                    {
                        field: 'linked_message',
                        value: 'message-id'
                    },
                    {
                        field: 'content',
                        value: 'The Iron Throne is mine!'
                    },
                    {
                        field: 'message_reactions',
                        value: `{
                            'unicode_string 1':{
                                'count': 1,
                                'users':['user1'],
                                'reaction': 'unicode_string 1'
                            }
                        }`
                    },
                    {
                        field: 'file',
                        value: 'https://ravenapp.info/_astro/app-screenshot.e5f6e34e.png'
                    },
                    {
                        field: 'json',
                        value: `{
                            content: [
                                {
                                    content: [
                                        {
                                            text: "The Iron Throne is mine!",
                                            type: "text"
                                        }
                                    ],
                                    type: "paragraph"
                                }
                            ],
                            type: "doc"
                        }`
                    },
                    {
                        field: 'name',
                        value: 'message-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            },
            {
                name: 'Winter is coming.',
                fields: [
                    {
                        field: 'channel_id',
                        value: 'winterfell'
                    },
                    {
                        field: 'text',
                        value: 'Winter is coming.'
                    },
                    {
                        field: 'message_type',
                        value: 'Text'
                    },
                    {
                        field: 'is_reply',
                        value: '0'
                    },
                    {
                        field: 'linked_message',
                        value: 'message-id'
                    },
                    {
                        field: 'content',
                        value: 'Winter is coming.'
                    },
                    {
                        field: 'message_reactions',
                        value: `{
                            'unicode_string 1':{
                                'count': 1,
                                'users':['user1'],
                                'reaction': 'unicode_string 1'
                            }
                        }`
                    },
                    {
                        field: 'file',
                        value: 'https://ravenapp.info/_astro/app-screenshot.e5f6e34e.png'
                    },
                    {
                        field: 'json',
                        value: `{
                            content: [
                                {
                                    content: [
                                        {
                                            text: "Winter is coming.",
                                            type: "text"
                                        }
                                    ],
                                    type: "paragraph"
                                }
                            ],
                            type: "doc"
                        }`
                    },
                    {
                        field: 'name',
                        value: 'message-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            },
            {
                name: 'Dracarys!',
                fields: [
                    {
                        field: 'channel_id',
                        value: 'dragons-bay'
                    },
                    {
                        field: 'text',
                        value: 'Dracarys!'
                    },
                    {
                        field: 'message_type',
                        value: 'Text'
                    },
                    {
                        field: 'is_reply',
                        value: '0'
                    },
                    {
                        field: 'linked_message',
                        value: 'message-id'
                    },
                    {
                        field: 'content',
                        value: 'Dracarys!'
                    },
                    {
                        field: 'message_reactions',
                        value: `{
                            'unicode_string 1':{
                                'count': 1,
                                'users':['user1'],
                                'reaction': 'unicode_string 1'
                            }
                        }`
                    },
                    {
                        field: 'file',
                        value: 'https://ravenapp.info/_astro/app-screenshot.e5f6e34e.png'
                    },
                    {
                        field: 'json',
                        value: `{
                            content: [
                                {
                                    content: [
                                        {
                                            text: "Dracarys!",
                                            type: "text"
                                        }
                                    ],
                                    type: "paragraph"
                                }
                            ],
                            type: "doc"
                        }`
                    },
                    {
                        field: 'name',
                        value: 'message-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            },
            {
                name: 'The Night King is coming.',
                fields: [
                    {
                        field: 'channel_id',
                        value: 'white-walkers'
                    },
                    {
                        field: 'text',
                        value: 'The Night King is coming.'
                    },
                    {
                        field: 'message_type',
                        value: 'Text'
                    },
                    {
                        field: 'is_reply',
                        value: '0'
                    },
                    {
                        field: 'linked_message',
                        value: 'message-id'
                    },
                    {
                        field: 'content',
                        value: 'The Night King is coming.'
                    },
                    {
                        field: 'message_reactions',
                        value: `{
                            'unicode_string 1':{
                                'count': 1,
                                'users':['user1'],
                                'reaction': 'unicode_string 1'
                            }
                        }`
                    },
                    {
                        field: 'file',
                        value: 'https://ravenapp.info/_astro/app-screenshot.e5f6e34e.png'
                    },
                    {
                        field: 'json',
                        value: `{
                            content: [
                                {
                                    content: [
                                        {
                                            text: "The Night King is coming.",
                                            type: "text"
                                        }
                                    ],
                                    type: "paragraph"
                                }
                            ],
                            type: "doc"
                        }`
                    },
                    {
                        field: 'name',
                        value: 'message-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            }
        ]
    },
    {
        trigger_event: ['Channel Member Added', 'Channel Member Deleted'],
        examples: [
            {
                name: 'Jon snow',
                fields: [
                    {
                        field: 'channel_id',
                        value: 'general'
                    },
                    {
                        field: 'user_id',
                        value: 'jon-snow'
                    },
                    {
                        field: 'is_admin',
                        value: '1'
                    },
                    {
                        field: 'last_visit',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'name',
                        value: 'channel-member-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            },
            {
                name: 'Daenerys Targaryen',
                fields: [
                    {
                        field: 'channel_id',
                        value: 'kings-landing'
                    },
                    {
                        field: 'user_id',
                        value: 'daenerys-targaryen'
                    },
                    {
                        field: 'is_admin',
                        value: '1'
                    },
                    {
                        field: 'last_visit',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'name',
                        value: 'channel-member-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            },
            {
                name: 'Arya Stark',
                fields: [
                    {
                        field: 'channel_id',
                        value: 'winterfell'
                    },
                    {
                        field: 'user_id',
                        value: 'arya-stark'
                    },
                    {
                        field: 'is_admin',
                        value: '1'
                    },
                    {
                        field: 'last_visit',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'name',
                        value: 'channel-member-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            },
        ]
    },
    {
        trigger_event: ['User Added', 'User Deleted'],
        examples: [
            {
                name: 'Jon Snow',
                fields: [
                    {
                        field: 'user',
                        value: 'jon-snow'
                    },
                    {
                        field: 'full_name',
                        value: 'Jon Snow'
                    },
                    {
                        field: 'first_name',
                        value: 'Jon'
                    },
                    {
                        field: 'enabled',
                        value: '1'
                    },
                    {
                        field: 'user_image',
                        value: 'https://example.com/image.jpg'
                    },
                    {
                        field: 'name',
                        value: 'user-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            },
            {
                name: 'Daenerys Targaryen',
                fields: [
                    {
                        field: 'user',
                        value: 'daenerys-targaryen'
                    },
                    {
                        field: 'full_name',
                        value: 'Daenerys Targaryen'
                    },
                    {
                        field: 'first_name',
                        value: 'Daenerys'
                    },
                    {
                        field: 'enabled',
                        value: '1'
                    },
                    {
                        field: 'user_image',
                        value: 'https://example.com/image.jpg'
                    },
                    {
                        field: 'name',
                        value: 'user-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            }
        ]
    },
    {
        trigger_event: ['Message Reacted On'],
        examples: [
            {
                name: '👍',
                fields: [
                    {
                        field: 'reaction',
                        value: '👍'
                    },
                    {
                        field: 'message',
                        value: 'message-id'
                    },
                    {
                        field: 'reaction_escaped',
                        value: '\\ud83d\\udc4d'
                    },
                    {
                        field: 'name',
                        value: 'reaction-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            },
            {
                name: '👎',
                fields: [
                    {
                        field: 'reaction',
                        value: '👎'
                    },
                    {
                        field: 'message',
                        value: 'message-id'
                    },
                    {
                        field: 'reaction_escaped',
                        value: '\\ud83d\\udc4e'
                    },
                    {
                        field: 'name',
                        value: 'reaction-id'
                    },
                    {
                        field: 'creation',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified',
                        value: '2021-08-12 12:00:00'
                    },
                    {
                        field: 'modified_by',
                        value: 'Administrator'
                    },
                    {
                        field: 'owner',
                        value: 'Administrator'
                    }
                ]
            }
        ]
    }
]