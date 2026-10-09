import Foundation
import Capacitor

/// Session for the media handler, and the media/ cache trim (contract: apps/web/src/native/media.ts).
@objc(RavenMediaPlugin)
public class RavenMediaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RavenMediaPlugin"
    public let jsName = "RavenMedia"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "trim", returnType: CAPPluginReturnPromise),
    ]
    private var folder: URL { FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("media") }

    @objc func setSession(_ call: CAPPluginCall) {
        let origin = call.getString("origin") ?? "", token = call.getString("token") ?? ""
        // The handler's state is main-thread only.
        DispatchQueue.main.async {
            RavenMediaHandler.shared.origin = origin
            RavenMediaHandler.shared.token = token
            call.resolve()
        }
    }

    // Nothing goes while the folder fits the budget. Over it, the oldest folders go first.
    @objc func trim(_ call: CAPPluginCall) {
        let budget = Int64(call.getDouble("budgetBytes") ?? Double(Int64.max))
        let fm = FileManager.default
        guard let folders = try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.contentModificationDateKey]) else { return call.resolve() }
        var total = folders.reduce(Int64(0)) { $0 + size($1) }
        let modified = { (url: URL) in (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast }
        for url in folders.sorted(by: { modified($0) < modified($1) }) where total > budget {
            total -= size(url)
            try? fm.removeItem(at: url)
        }
        call.resolve()
    }

    private func size(_ url: URL) -> Int64 {
        let files = (try? FileManager.default.contentsOfDirectory(at: url, includingPropertiesForKeys: [.fileSizeKey])) ?? []
        return files.reduce(0) { $0 + Int64((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
    }
}
