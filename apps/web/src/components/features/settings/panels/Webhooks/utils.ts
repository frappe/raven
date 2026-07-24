
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