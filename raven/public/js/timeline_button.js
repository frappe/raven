// "Send a Raven" button on every form timeline the user can read.

frappe.provide("frappe.raven");

/**
 * The first icon name the page's sprite actually has. Raven's own icons
 * come from hooks.py, lucide names from Frappe v16, and the last candidates
 * cover Frappe v15, whose sprite uses different names.
 */
frappe.raven.icon_name = (...candidates) =>
  candidates.find((name) => name && document.getElementById(`icon-${name}`));

/** The icon markup for the first available name, or nothing at all. */
frappe.raven.icon = (name, fallback, size = "sm") => {
  const known = frappe.raven.icon_name(name, fallback);
  return known ? frappe.utils.icon(known, size) : "";
};

$(document).on("app_ready", function () {
  $.each(frappe.boot.user.can_read, function (i, doctype) {
    frappe.ui.form.on(doctype, {
      refresh(frm) {
        const timeline = frm.footer?.frm?.timeline;
        if (frm.is_new() || !timeline) return;
        if (timeline.timeline_actions_wrapper.find(".send-raven-button").length) return;
        add_send_button(timeline, frm);
      },
    });
  });
});

/**
 * The timeline helper draws every button icon at 12px. That suits a line
 * icon, but the Raven logo is a filled square and reads too small, so it is
 * drawn here at 16px instead. The fallbacks are line icons and keep 12px.
 */
const add_send_button = (timeline, frm) => {
  const label = __("Send a Raven");
  const open = () => open_send_dialog(frm);
  const classes = "btn-secondary send-raven-button";
  if (!frappe.raven.icon_name("raven")) {
    timeline.add_action_button(label, open, frappe.raven.icon_name("send", "share"), classes);
    return;
  }
  const button = timeline.add_action_button(label, open, "raven", classes);
  button.find("svg.icon").removeClass("icon-xs").addClass("icon-sm");
};

const open_send_dialog = (frm) => {
  frappe
    .xcall("raven.api.raven_channel.get_channels", { hide_archived: true })
    .then((channels) => {
      if (!channels?.length) {
        frappe.msgprint({ title: __("Send a Raven"), indicator: "blue", message: __("No channels found") });
        return;
      }
      show_send_dialog(frm, channels);
    });
};

/** One list for channels and DMs. The description tells them apart. */
const channel_options = (channels) =>
  channels.map((channel) => ({
    value: channel.name,
    label: channel.is_direct_message ? channel.full_name || channel.peer_user_id : channel.channel_name,
    description: channel.is_direct_message ? __("Direct Message") : channel.workspace,
  }));

const show_send_dialog = (frm, channels) => {
  const dialog = new frappe.ui.Dialog({
    title: __("Send a Raven"),
    fields: [
      {
        fieldname: "channel",
        label: __("Channel or Person"),
        fieldtype: "Autocomplete",
        options: channel_options(channels),
        reqd: 1,
      },
      { fieldname: "message", label: __("Message"), fieldtype: "Long Text" },
      { fieldtype: "Section Break" },
      { fieldname: "select_attachments", label: __("Select Attachments"), fieldtype: "HTML" },
    ],
    primary_action_label: __("Send"),
    primary_action(values) {
      send_message(frm, values.channel, values.message, selected_attachment(dialog));
      dialog.hide();
    },
    secondary_action_label: __("Discard"),
    secondary_action: () => dialog.hide(),
    minimizable: true,
  });
  setup_attachments(frm, dialog);
  dialog.show();
};

const setup_attachments = (frm, dialog) => {
  const wrapper = $(dialog.fields_dict.select_attachments.wrapper).empty();
  $(`
    <label class="control-label">${__("Select Attachments")}</label>
    <div class="attach-list"></div>
    <p class="add-more-attachments">
      <button class="btn btn-xs btn-default">
        ${frappe.raven.icon("plus", "small-add", "xs")}&nbsp;${__("Add Attachment")}
      </button>
    </p>
  `).appendTo(wrapper);

  const uploader_args = {
    doctype: frm.doctype,
    docname: frm.docname,
    folder: "Home/Attachments",
    on_success: (attachment) => {
      frm.attachments.attachment_uploaded(attachment);
      render_attachment_rows(frm, wrapper);
    },
  };
  wrapper.find(".add-more-attachments button").on("click", () => new frappe.ui.FileUploader(uploader_args));
  render_attachment_rows(frm, wrapper);
};

const render_attachment_rows = (frm, wrapper) => {
  const rows = wrapper.find(".attach-list").empty();
  frm.get_files().forEach((file) => {
    if (!file.file_name) return;
    rows.append(`
      <p class="flex">
        <label class="attachment-radio">
          <input type="radio" name="raven-attachment" data-file-name="${file.name}">
          <span class="ellipsis">${frappe.utils.escape_html(file.file_name)}</span>
        </label>
        &nbsp;
        <a href="${frappe.urllib.get_full_url(file.file_url)}" target="_blank">
          ${frappe.raven.icon("link", "link-url", "xs")}
        </a>
      </p>
    `);
  });
};

const selected_attachment = (dialog) =>
  $(dialog.wrapper).find("[data-file-name]:checked").attr("data-file-name") || "";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif"];

const message_type_for = (file_url) => {
  if (!file_url) return "Text";
  return IMAGE_EXTENSIONS.includes(file_url.split(".").pop().toLowerCase()) ? "Image" : "File";
};

const send_message = (frm, channel, message, attachment) => {
  const file_url = attachment
    ? frappe.db.get_value("File", attachment, "file_url").then((r) => r.message?.file_url || "")
    : Promise.resolve("");

  file_url
    .then((url) =>
      frappe.db.insert({
        doctype: "Raven Message",
        channel_id: channel,
        text: message,
        json: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: message }] }],
        },
        message_type: message_type_for(url),
        file: url,
        link_doctype: frm.doctype,
        link_document: frm.docname,
      }),
    )
    .then(() => {
      frm.reload_doc();
      frappe.show_alert({ message: __("Message sent"), indicator: "green" });
      frappe.utils.play_sound("email");
    })
    .catch(() => frappe.throw(__("Error sending message")));
};
