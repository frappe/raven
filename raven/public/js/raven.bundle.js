// $(document).on('app_ready', function () {
//     if (frappe.boot.show_raven_chat_on_desk && frappe.user.has_role("Raven User")) {

//         try {
//             // If on mobile or on frappe v16, do not show the chat
//             if (frappe.is_mobile() || frappe.boot.versions["frappe"].startsWith('16') || frappe.boot.versions["frappe"].startsWith('17')) {
//                 return;
//             }
//             let main_section = $(document).find('.main-section');

//             // Add bottom padding to the main section
//             main_section.css('padding-bottom', '60px');

//             let chat_element = $(document.createElement('div'));
//             chat_element.addClass('raven-chat');

//             main_section.append(chat_element);

//             frappe.require("raven_chat.bundle.jsx").then(() => {
//                 frappe.raven_chat = new frappe.ui.RavenChat({
//                     wrapper: chat_element,
//                 });
//             });
//         } catch (error) {
//             console.error(error);
//         }
//     }

// });
import './templates/send_message.html';
import './timeline_button';
