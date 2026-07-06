// Timeline button for Frappe
$(document).on('app_ready', function () {
  $.each(frappe.boot.user.can_read, function (i, doctype) {
    let buttonAdded = false; // Track if the button has been added

    frappe.ui.form.on(doctype, {
      refresh: function (frm) {
        if (!frm.is_new()) {
          if (frm.footer?.frm?.timeline && !buttonAdded) {
            let send_message_modal = (channels) => {
              if (channels && channels.message && channels.message.length > 0) {
                let channel_id = [];
                let dm_list = [];
                let channel_list = [];

                channels.message.forEach((channel) => {
                  if (channel.is_direct_message) {
                    if (channel.full_name) {
                      dm_list.push(channel.full_name);
                      channel_id.push({
                        value: channel.name,
                        name: channel.full_name,
                      });
                    }
                  } else {
                    channel_list.push(channel.channel_name);
                    channel_id.push({
                      value: channel.name,
                      name: channel.channel_name,
                    });
                  }
                });

                let setup_attach = () => {
                  const fields = dialog.fields_dict;
                  const attach = $(fields.select_attachments.wrapper);

                  if (!frm.attachments) {
                    frm.attachments = [];
                  }

                  let args = {
                    folder: 'Home/Attachments',
                    on_success: (attachment) => {
                      frm.attachments.push(attachment);
                      render_attachment_rows();
                    },
                  };

                  if (frm) {
                    args = {
                      doctype: frm.doctype,
                      docname: frm.docname,
                      folder: 'Home/Attachments',
                      on_success: (attachment) => {
                        frm.attachments.attachment_uploaded(attachment);
                        render_attachment_rows();
                      },
                    };
                  }

                  $(`
                    <label class="control-label">
                      ${__('Select Attachments')}
                    </label>
                    <div class='attach-list'></div>
                    <p class='add-more-attachments'>
                      <button class='btn btn-xs btn-default'>
                        ${frappe.utils.icon('small-add', 'xs')}&nbsp;
                        ${__('Add Attachment')}
                      </button>
                    </p>
                  `).appendTo(attach.empty());

                  attach
                    .find('.add-more-attachments button')
                    .on('click', () => new frappe.ui.FileUploader(args));
                  render_attachment_rows();
                };

                let render_attachment_rows = (attachment) => {
                  const select_attachments =
                    dialog.fields_dict.select_attachments;
                  const attachment_rows = $(select_attachments.wrapper).find(
                    '.attach-list'
                  );

                  // Clear existing attachments
                  attachment_rows.empty();

                  if (attachment) {
                    attachment_rows.append(
                      get_attachment_row(attachment, true)
                    );
                  } else {
                    let files = [];
                    // Add attachments from form
                    // check if attachment already exists in files array

                    if (frm.attachments && frm.attachments.length) {
                      // files = files.concat(frm.attachments);
                      files = files.concat(
                        frm.attachments.filter((attachment, index, array) => {
                          return !array
                            .slice(0, index)
                            .some(
                              (obj) => obj.file_name === attachment.file_name
                            );
                        })
                      );
                    }
                    if (frm) {
                      files = files.concat(frm.get_files());

                      files = files.filter((attachment, index, array) => {
                        return !array
                          .slice(0, index)
                          .some(
                            (obj) => obj.file_name === attachment.file_name
                          );
                      });
                    }

                    if (files.length) {
                      $.each(files, (i, f) => {
                        if (!f.file_name) return;
                        if (
                          !attachment_rows.find(`[data-file-name="${f.name}"]`)
                            .length
                        ) {
                          f.file_url = frappe.urllib.get_full_url(f.file_url);
                          attachment_rows.append(get_attachment_row(f));
                        }
                      });
                    }
                  }
                };

                let get_attachment_row = (attachment, checked) => {
                  const radioGroupName = 'attachmentRadioGroup';

                  return $(`
                    <p class="flex">
                      <label class="attachment-radio">
                        <input type="radio" name="${radioGroupName}"
                               data-file-name="${attachment.name}" ${checked ? 'checked' : ''
                    }>
                        </input>
                        <span class="ellipsis">${attachment.file_name}</span>
                      </label>
                      &nbsp;
                      <a href="${attachment.file_url
                    }" target="_blank" class="btn-linkF">
                        ${frappe.utils.icon('link-url')}
                      </a>
                    </p>`);
                };

                let get_attachments = () => {
                  const selected_attachment = $(dialog.wrapper)
                    .find('[data-file-name]:checked')
                    .attr('data-file-name');
                  return selected_attachment ? selected_attachment : '';
                };

                let dialog;
                if (!dialog) {
                  dialog = new frappe.ui.Dialog({
                    title: __('Send a Raven'),
                    fields: [
                      {
                        fieldname: 'type',
                        label: 'Type',
                        fieldtype: 'Select',
                        options: ['DM', 'Channel'],
                        default: 'Channel',
                        onchange: function () {
                          let field = dialog.get_field('channel');
                          if (this.value === 'DM') {
                            field.df.options = dm_list;
                          } else {
                            field.df.options = channel_list;
                          }
                          field.refresh();
                        },
                      },
                      {
                        fieldname: 'channel',
                        label: 'Channel/DM',
                        fieldtype: 'Select',
                        options: channel_list,
                        reqd: 1,
                      },
                      {
                        fieldname: 'message',
                        label: 'Message',
                        fieldtype: 'Long Text',
                        // reqd: 1,
                      },
                      { fieldtype: 'Section Break' },
                      {
                        label: __('Select Attachments'),
                        fieldtype: 'HTML',
                        fieldname: 'select_attachments',
                      },
                    ],
                    primary_action_label: __('Send'),
                    primary_action(values) {
                      let attachments = get_attachments();
                      send_message(values, channel_id, attachments);
                      dialog.hide();
                    },
                    secondary_action_label: __('Discard'),
                    secondary_action() {
                      dialog.hide();
                    },
                    minimizable: true,
                  });
                }
                setup_attach();
                dialog.show();
              } else {
                frappe.msgprint({
                  title: __('Send a Raven'),
                  indicator: 'blue',
                  message: __('No channels found'),
                });
              }
            };

            let get_channels = () => {
              return frappe.call({
                method: 'raven.api.raven_channel.get_channels',
                args: {
                  hide_archived: true,
                },
                callback: function (r) {
                  if (r && r.message) {
                    return r.message;
                  }
                },
              });
            };

            let send_message = (values, channel_id, attachments) => {
              // let channel = values.channel;
              let channel = channel_id.find(
                (channel) => channel.name == values.channel
              ).value;
              // get message from values.message and clean it up, remove html tags
              // let message = values.message.replace(/<[^>]*>?/gm, '');
              let message = values.message;

              let get_type = (url) => {
                if (url) {
                  let fileExt = [
                    'jpg',
                    'JPG',
                    'jpeg',
                    'JPEG',
                    'png',
                    'PNG',
                    'gif',
                    'GIF',
                  ];
                  let ext = url.split('.').pop();
                  if (fileExt.includes(ext)) {
                    return 'Image';
                  } else {
                    return 'File';
                  }
                }
                return 'Text';
              };

              frappe.db
                .get_value('File', { name: attachments }, 'file_url')
                .then((res) => {
                  return frappe.db.insert({
                    doctype: 'Raven Message',
                    channel_id: channel,
                    text: message,
                    json: {
                      "content": [
                        {
                          "content": [
                            {
                              "text": message,
                              "type": "text"
                            }
                          ],
                          "type": "paragraph"
                        }
                      ],
                      "type": "doc"
                    },
                    message_type: get_type(res?.message?.file_url),
                    file: res?.message?.file_url || '',
                    link_doctype: frm.doctype,
                    link_document: frm.docname,
                  });
                })
                .then(() => {
                  frm.reload_doc();
                  frappe.show_alert({
                    message: __('Message sent'),
                    indicator: 'green',
                  });
                  frappe.utils.play_sound('email');
                })
                .catch((err) => {
                  frappe.throw(__('Error sending message'));
                });
            };

            let send_raven = () => {
              get_channels().then((channels) => send_message_modal(channels));
            };

            var timeline = frm.footer.frm.timeline;
            // check the button is not already added by checking the class name 'send-raven-button'

            timeline.add_action_button(
              __('Send a Raven'),
              send_raven,
              'share',
              'btn-secondary send-raven-button'
            );
            buttonAdded = true;
          }
        }
      },
    });
  });
});
