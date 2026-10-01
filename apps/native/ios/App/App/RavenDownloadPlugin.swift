import Foundation
import Capacitor

/// File download with progress and cancel; the Filesystem plugin's downloadFile has neither.
@objc(RavenDownloadPlugin)
public class RavenDownloadPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDownloadDelegate {
    public let identifier = "RavenDownloadPlugin"
    public let jsName = "RavenDownload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "download", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
    ]
    private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
    // Touched from plugin calls and the session's delegate queue alike.
    private let lock = NSLock()
    private var tasks: [String: (task: URLSessionDownloadTask, call: CAPPluginCall, target: URL)] = [:]
    private var reportedAt: [String: TimeInterval] = [:]
    private var folder: URL { FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("media") }

    // download({ id, url, name, headers }) writes Caches/media/<folder>/<file> and resolves { path } when complete.
    // The page names the file but never the location; only http(s) sources are fetched.
    @objc func download(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let url = URL(string: call.getString("url") ?? ""), let name = call.getString("name"),
              ["http", "https"].contains(url.scheme ?? ""), Self.isSafeName(name) else {
            return call.reject("bad name or url")
        }
        var request = URLRequest(url: url)
        for (key, value) in call.getObject("headers") ?? [:] { request.setValue(value as? String, forHTTPHeaderField: key) }
        let task = session.downloadTask(with: request)
        task.taskDescription = id
        lock.withLock { tasks[id] = (task, call, folder.appendingPathComponent(name)) }
        task.resume()
    }

    // name is <folder>/<file>: one level, no traversal.
    private static func isSafeName(_ name: String) -> Bool {
        let parts = name.split(separator: "/", omittingEmptySubsequences: false)
        return parts.count == 2 && parts.allSatisfy { !$0.isEmpty && $0 != ".." && !$0.hasPrefix(".") }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        lock.withLock { tasks[call.getString("id") ?? ""]?.task.cancel() }
        call.resolve()
    }

    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        // At most ten events a second keeps the bridge quiet on fast links.
        let id = downloadTask.taskDescription ?? "", now = Date().timeIntervalSince1970
        let due = lock.withLock { now - (reportedAt[id] ?? 0) >= 0.1 || totalBytesWritten == totalBytesExpectedToWrite }
        guard due else { return }
        lock.withLock { reportedAt[id] = now }
        notifyListeners("progress", data: ["id": id, "bytes": totalBytesWritten, "total": totalBytesExpectedToWrite])
    }

    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let id = downloadTask.taskDescription, let entry = lock.withLock({ tasks.removeValue(forKey: id) }) else { return }
        let status = (downloadTask.response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else { return entry.call.reject("HTTP \(status)") }
        do {
            try FileManager.default.createDirectory(at: entry.target.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? FileManager.default.removeItem(at: entry.target)
            try FileManager.default.moveItem(at: location, to: entry.target)
            entry.call.resolve(["path": entry.target.path])
        } catch {
            entry.call.reject(error.localizedDescription)
        }
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let id = task.taskDescription else { return }
        let entry = lock.withLock { () -> (task: URLSessionDownloadTask, call: CAPPluginCall, target: URL)? in
            reportedAt.removeValue(forKey: id)
            return tasks.removeValue(forKey: id)
        }
        guard let error = error, let entry = entry else { return }
        entry.call.reject((error as NSError).code == NSURLErrorCancelled ? "cancelled" : error.localizedDescription)
    }
}
