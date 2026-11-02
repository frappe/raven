import Foundation
import UIKit
import Contacts
import ContactsUI
import Capacitor

/// Contact picker and new-contact screen without any contacts permission (contract: apps/web/src/native/contacts.ts).
@objc(RavenContactsPlugin)
public class RavenContactsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RavenContactsPlugin"
    public let jsName = "RavenContacts"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickContact", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveContact", returnType: CAPPluginReturnPromise),
    ]

    private struct ContactField {
        let value: String
        let label: String?
    }

    private var pickCall: CAPPluginCall?

    @objc func pickContact(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // A picker swiped away may never report back; release that call rather than block every later pick.
            self.pickCall?.resolve()
            guard let presenter = self.topViewController() else { return call.reject("No view controller to present the picker") }
            self.pickCall = call
            let picker = CNContactPickerViewController()
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    @objc func saveContact(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.topViewController() else { return call.reject("No view controller to present the contact") }
            let editor = CNContactViewController(forNewContact: self.contact(from: call))
            editor.delegate = self
            presenter.present(UINavigationController(rootViewController: editor), animated: true)
            // Like Android: the system editor owns the outcome, so the call ends once it is shown.
            call.resolve()
        }
    }

    private func topViewController() -> UIViewController? {
        var top = bridge?.viewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }

    private func contact(from call: CAPPluginCall) -> CNMutableContact {
        let contact = CNMutableContact()
        let name = (call.getString("name") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let components = PersonNameComponentsFormatter().personNameComponents(from: name)
        contact.givenName = components?.givenName ?? ""
        contact.middleName = components?.middleName ?? ""
        contact.familyName = components?.familyName ?? ""
        contact.namePrefix = components?.namePrefix ?? ""
        contact.nameSuffix = components?.nameSuffix ?? ""
        if contact.givenName.isEmpty && contact.middleName.isEmpty && contact.familyName.isEmpty {
            contact.organizationName = name
        }
        contact.phoneNumbers = fields(call, "phones").map {
            CNLabeledValue(label: contactLabel($0.label, phone: true), value: CNPhoneNumber(stringValue: $0.value))
        }
        contact.emailAddresses = fields(call, "emails").map {
            CNLabeledValue(label: contactLabel($0.label, phone: false), value: $0.value as NSString)
        }
        if let photo = call.getString("photo"), let data = Data(base64Encoded: photo) {
            contact.imageData = data
        }
        return contact
    }

    private func fields(_ call: CAPPluginCall, _ key: String) -> [ContactField] {
        (call.getArray(key) ?? []).compactMap { item in
            guard let object = item as? JSObject, let value = object["value"] as? String, !value.isEmpty else { return nil }
            return ContactField(value: value, label: object["label"] as? String)
        }
    }

    // The server's canonical labels map to system ones, so Contacts shows its own translation.
    private func contactLabel(_ label: String?, phone: Bool) -> String {
        switch label?.lowercased() {
        case "home": return CNLabelHome
        case "work": return CNLabelWork
        case "other", nil: return CNLabelOther
        case "mobile" where phone: return CNLabelPhoneNumberMobile
        case "main" where phone: return CNLabelPhoneNumberMain
        default: return label ?? CNLabelOther
        }
    }

    private func serialized(_ contact: CNContact) -> JSObject {
        var result: JSObject = [:]
        let formatted = CNContactFormatter.string(from: contact, style: .fullName) ?? ""
        result["name"] = formatted.isEmpty ? contact.organizationName : formatted
        result["phones"] = contact.phoneNumbers.map { field($0.value.stringValue, $0.label) }
        result["emails"] = contact.emailAddresses.map { field($0.value as String, $0.label) }
        if let photo = photoBase64(contact) { result["photo"] = photo }
        return result
    }

    private func field(_ value: String, _ label: String?) -> JSObject {
        var field: JSObject = ["value": value]
        let localized = CNLabeledValue<NSString>.localizedString(forLabel: label ?? "")
        if !localized.isEmpty { field["label"] = localized }
        return field
    }

    private func photoBase64(_ contact: CNContact) -> String? {
        // The thumbnail is already small and cropped; the full image is only a fallback.
        var data: Data?
        if contact.isKeyAvailable(CNContactThumbnailImageDataKey) { data = contact.thumbnailImageData }
        if data == nil && contact.isKeyAvailable(CNContactImageDataKey) { data = contact.imageData }
        guard let data, let image = UIImage(data: data) else { return nil }
        return resized(image).jpegData(compressionQuality: 0.85)?.base64EncodedString()
    }

    private func resized(_ image: UIImage) -> UIImage {
        let longest = max(image.size.width, image.size.height)
        guard longest > 512 else { return image }
        let scale = 512 / longest
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            // JPEG has no alpha: transparent pixels would encode black.
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}

extension RavenContactsPlugin: CNContactPickerDelegate, CNContactViewControllerDelegate {
    public func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
        let call = pickCall
        pickCall = nil
        call?.resolve(["contact": serialized(contact)])
    }

    public func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
        let call = pickCall
        pickCall = nil
        call?.resolve()
    }

    public func contactViewController(_ viewController: CNContactViewController, didCompleteWith contact: CNContact?) {
        viewController.dismiss(animated: true)
    }
}
