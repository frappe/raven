# TODO: product issues found while writing the user docs

Found in October 2026 while checking docs.frappe.io/raven against the code and the demo site. The docs describe only what works today. When an item is fixed, update the docs page named in brackets.

## Notifications

- [ ] Per-channel notification options do nothing. The Push notifications and In-app notifications rows in the channel drawer keep local state only (`ChannelSettingsDrawer/ChannelSettingsTab.tsx`), and the channel header menu's All Notifications / Mentions Only / Mute Channel items have empty click handlers (`ChannelHeader/ChannelMenu.tsx`). Only the bell in Settings > Channels works, and the backend has no "mentions only" level. [Mute a channel]
- [ ] Quiet hours default: the Raven User field defaults to "No Nudge", while `boot.py` and code comments still treat "Nudge" as the default. Pick one. [Quiet hours]
- [ ] The quiet hours banner always shows the Mac shortcut ⌘⇧↵, also on Windows and Linux. [Quiet hours]

## Channels

- [ ] "Create a new channel" shows even when the workspace has "Only admins can create channels" on. Other members get an error. [Create a channel]
- [ ] A Raven Admin who is a channel member but not a channel admin sees "Remove from channel" enabled (`canManageChannel`), but the server only lets channel admins remove members (`raven/permissions.py`, `channel_member_has_permission`). [Add and remove members]
- [ ] Any channel member may add people on the server, but the Add button only shows for channel admins and Raven Admins. Decide which is right. [Add and remove members]
- [ ] Rows in the channel drawer's Threads tab look clickable but have no click handler (`ChannelSettingsDrawer/ChannelThreads.tsx`). [Channel files, links, threads and pins]
- [ ] The Favorites star tooltip always says "Add to Favorites", even for a favorite. [Organize your sidebar]
- [ ] Leave in Settings > Channels leaves at once; Leave in the channel drawer asks first. Make them the same. [Join and leave channels]
- [ ] The sidebar filters only apply at 15 or more channels (`packages/lib/utils/buildChannelSidebarData.ts`, `FILTER_MIN_CHANNELS`), and never hide Open, Favorite or grouped channels. The setting's own description says neither. [Preferences]

## Messages

- [ ] Settings > Appearance says "4+ images always use the carousel", but `MessageImages.tsx` uses the carousel for 5 or more (`images.length > 4`). [Files and links]
- [ ] A pasted link to a document on the same site (/app, /desk) gets no preview card. Only the composer's document button makes a card. [Share documents in a message]
- [ ] Custom emoji show as raw shortcodes (":lumen:") in search results on mobile. [Search]
- [ ] `hide_link_preview` exists on the message, but nothing in the UI sets it. [Files and links]

## Threads and search

- [ ] The Threads page still has an "AI Agents" filter, on desktop and mobile, though AI is deprecated. [Threads]
- [ ] The Threads empty state says 'Create Thread'; the menu item is "Create thread".
- [ ] "Unread only" on the Threads page's Other tab is always empty, because those threads are never unread.
- [ ] Search builds a "Clear all" action for active filters but never shows it. [Search]

## Workspaces and users

- [ ] "Can only join via invite?" can only be set in Desk. The web app hides Join for such workspaces, but the server still lets anyone join a public one.
- [ ] Add User with one workspace pre-ticks it (disabled, can't untick) even when the System Manager is not that workspace's admin, so `invite_user` fails the write check (`AddUserDialog.tsx` defaultValues, `WorkspaceAccessPicker`). [Add people to Raven]
- [ ] Typo in `WorkspaceAccessPicker`: "cannot manage it's members" should be "its".
- [ ] The DM header's "View profile" opens the panel on its Files tab. [Direct messages]

## Settings and permissions

- [ ] Webhooks and Scheduled Messages tabs show to Raven Admins (`isRavenSettingsAdmin`), but Raven Webhook and Raven Scheduler Event give permission to System Manager only, and Scheduled Messages also needs System Manager to create the Server Script. [Webhooks] [Recurring bot messages]
- [ ] Emojis: the delete button shows on every row; people who are not admins can only delete emoji they added and get a permission error on others. [Custom emoji]
- [ ] Settings placeholders name specific document types ("Salary Slip Notification", `doc.employee_name`).
- [ ] Ctrl/⌘ + / did not open Settings in Playwright's Chrome on a Mac. Check by hand.

## Webhooks and bots

- [ ] Channel Member Added and Channel Member Deleted triggers: `RavenWebhook.get_doctype_and_event` uses labels that don't match the Select options, so the webhook gets no doctype. Left out of the docs. [Webhooks]
- [ ] Disabling a webhook does nothing: `Raven Webhook.enabled` is never copied to the Frappe Webhook. [Webhooks]
- [ ] Conditions the UI offers that the backend rejects or ignores: Channel on Message Reacted On (error), Channel Type on message and member triggers (error), User on Channel Created/Deleted (error), User on User Added/Deleted (ignored, fires for every user). [Webhooks]
- [ ] Data and Headers rows can only be added after creation, never removed or updated (`set_webhook_data_and_headers`). [Webhooks]
- [ ] Deleting a webhook uses `frappe.db.delete` in `on_trash`, which skips the webhook cache, so it may keep firing until the cache clears. Not tested.
- [ ] Message Edited fires on any save of the message record, not only text edits.
- [ ] Webhook requests send a JSON body while the record says "Form URL-Encoded", with no Content-Type header. [Webhooks]
- [ ] Incoming webhook: opening an existing record in Desk marks it "Not Saved" (the form script calls `set_value` on `webhook_url` in refresh). The Bot field links to Raven User, so it also lists people. Empty content posts an empty message. [Incoming webhooks]
- [ ] Agents live under the AI group in Settings, though AI is deprecated. Move Agents out of the AI group. [Agents]
- [ ] The agent form in Settings has no image field; an agent's picture can only be set in Desk. [Agents]
- [ ] The "Is AI Agent" description still says "Check to enable AI features for this bot". [Agents]

## Frappe apps and HR

- [ ] Message actions: the Server Script "View Docs" sample uses `frappe.form_dict.values.field1`, which fails (`values` is a dict method on form_dict). Use `frappe.form_dict.get("values")` and `.get("field")`. In `MessageActionForm.tsx` (EXAMPLES). [Message actions]
- [ ] Message actions: Edit Field shows an empty Field box when the field type is not in `VALID_FIELD_TYPES` (`messageActionFieldUtils.ts`), for example Text Editor. [Message actions]
- [ ] Frappe HR department channels are only created for departments made after the setting is turned on, are skipped when the company has no workspace mapping (a code comment says a default workspace is used), and employees whose User ID is set later are not added (TODO in `employee.py`). [Frappe HR]
- [ ] A broken document notification condition blocks saving the document. [Document notifications]

## Push and mobile

- [ ] Frappe Cloud sites are set up for push automatically only when the server config has `raven_push_notification_server_url`. Confirm every Frappe Cloud server has it. [Set up push notifications]
- [ ] README says the apps connect to "Raven 3 or later"; the app requires 3.1.0 (`MIN_SITE_VERSION`).
- [ ] The Add site screen's placeholder is `raven.frappe.cloud`; the docs use `yourcompany.frappe.cloud`.

## Demo site

- [ ] Maya is not a workspace admin of Lumen Cycles or Dealers (only Administrator is), so some docs shots fake the admin view in the browser.
- [ ] Maya is a member of every public channel, so there is no "Join" shot.
- [ ] Server scripts are off, so the seeded recurring message never runs.
- [ ] Suresh Pillai does not show in the @ mention list (probably disabled).
- [ ] The demo site shows as 127.0.0.1:8028 in the mobile site picker.
