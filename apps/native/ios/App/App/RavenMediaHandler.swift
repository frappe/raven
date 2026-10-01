import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves raven-media://<folder>/<file>?src=<site url>: the bearer goes only to the session's origin.
/// WebKit's player asks a custom scheme for a few kilobytes at a time; answered from the network one
/// by one, playback falls behind, so the site is read in blocks ahead of it and answered from memory.
final class RavenMediaHandler: NSObject, WKURLSchemeHandler {
    static let shared = RavenMediaHandler()
    var origin = ""
    var token = ""

    // Blocks are fetched this size, and this many are kept ahead of the last one asked for.
    private static let block = 1 << 20
    private static let ahead = 4
    // Memory held per file, and how many files: a long video past this is read again next time.
    private static let keepBlocks = 32
    private static let keepFiles = 2

    // Everything about blocks lives on this queue; everything handed to WebKit goes through main,
    // where WebKit stops tasks too, so a stopped task is never touched and no lock is needed.
    private let net = DispatchQueue(label: "raven.media.net", qos: .userInitiated)
    private lazy var session: URLSession = {
        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1
        queue.underlyingQueue = net
        let configuration = URLSessionConfiguration.default
        // Blocks are kept here already; a second copy in the URL cache would only cost memory.
        configuration.urlCache = nil
        return URLSession(configuration: configuration, delegate: nil, delegateQueue: queue)
    }()
    // File writes stay off the main thread.
    private let disk = DispatchQueue(label: "raven.media.disk")
    private var folder: URL { FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("media") }

    /// A request WebKit is waiting on. Main thread only.
    private final class Delivery {
        let scheme: WKURLSchemeTask
        var stopped = false
        init(scheme: WKURLSchemeTask) { self.scheme = scheme }
    }
    // Main thread only. A delivery holds its task, so no other task can take its identity meanwhile.
    private var live: [ObjectIdentifier: Delivery] = [:]

    /// One site file being read in blocks. Net queue only.
    private final class File {
        let src: URL
        let target: URL
        var total: Int?
        var type = "application/octet-stream"
        var blocks: [Int: Data] = [:]
        // Least recently used first.
        var used: [Int] = []
        var waiting: [Int: [(Bool) -> Void]] = [:]
        init(src: URL, target: URL) { self.src = src; self.target = target }
    }
    // Net queue only, oldest first.
    private var files: [File] = []

    func webView(_ webView: WKWebView, start schemeTask: WKURLSchemeTask) {
        guard let url = schemeTask.request.url, let host = url.host,
              let src = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "src" })?.value,
              !origin.isEmpty, src.hasPrefix(origin + "/"), let srcURL = URL(string: src) else {
            return fail(schemeTask, status: 403)
        }
        // Media elements only: as a page, a site file would run inside the app's WebView with the native bridge.
        if schemeTask.request.mainDocumentURL == url { return fail(schemeTask, status: 403) }
        let target = folder.appendingPathComponent(host).appendingPathComponent(url.lastPathComponent)
        let range = schemeTask.request.value(forHTTPHeaderField: "Range")
        if FileManager.default.fileExists(atPath: target.path) { return fromDisk(schemeTask, file: target, range: range) }
        let delivery = Delivery(scheme: schemeTask)
        live[ObjectIdentifier(schemeTask)] = delivery
        let bearer = token
        net.async { self.serve(delivery, file: self.file(src: srcURL, target: target), range: range, bearer: bearer) }
    }

    // WebKit stops a task it has abandoned (scrolled away, seek). The blocks already on their way
    // are still worth having: they are the read-ahead for the next request.
    func webView(_ webView: WKWebView, stop schemeTask: WKURLSchemeTask) {
        live.removeValue(forKey: ObjectIdentifier(schemeTask))?.stopped = true
    }

    // MARK: - Blocks (net queue)

    private func file(src: URL, target: URL) -> File {
        if let known = files.first(where: { $0.target == target }) { return known }
        let file = File(src: src, target: target)
        files.append(file)
        if files.count > Self.keepFiles { files.removeFirst() }
        return file
    }

    private func serve(_ delivery: Delivery, file: File, range: String?, bearer: String) {
        let asked = Self.parse(range)
        // The first block needed also tells the file's size, which an open or suffix range needs.
        let opening = (asked?.first ?? 0) / Self.block
        load(file, blocks: [opening], bearer: bearer) { ok in
            guard ok, let total = file.total else { return self.fail(delivery, status: 502) }
            guard let (start, end) = Self.bounds(asked, total: total) else { return self.fail(delivery, status: 416) }
            let wanted = Array(start / Self.block ... end / Self.block)
            self.load(file, blocks: wanted, bearer: bearer) { ok in
                guard ok, let body = self.assemble(file, from: start, to: end) else { return self.fail(delivery, status: 502) }
                var headers = ["Content-Type": file.type, "Accept-Ranges": "bytes", "Content-Length": String(body.count), "X-Content-Type-Options": "nosniff"]
                if range != nil { headers["Content-Range"] = "bytes \(start)-\(end)/\(total)" }
                self.deliver(delivery, status: range == nil ? 200 : 206, headers: headers, body: body)
                self.readAhead(file, after: end / Self.block, bearer: bearer)
            }
        }
    }

    private func load(_ file: File, blocks: [Int], bearer: String, done: @escaping (Bool) -> Void) {
        var remaining = blocks.count
        var ok = true
        guard remaining > 0 else { return done(true) }
        for index in blocks {
            fetch(file, index: index, bearer: bearer) { fetched in
                ok = ok && fetched
                remaining -= 1
                if remaining == 0 { done(ok) }
            }
        }
    }

    private func fetch(_ file: File, index: Int, bearer: String, done: @escaping (Bool) -> Void) {
        if file.blocks[index] != nil {
            touch(file, index)
            return done(true)
        }
        if let total = file.total, index * Self.block >= total { return done(false) }
        if file.waiting[index] != nil {
            file.waiting[index]?.append(done)
            return
        }
        file.waiting[index] = [done]
        var request = URLRequest(url: file.src)
        request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        let from = index * Self.block
        request.setValue("bytes=\(from)-\(from + Self.block - 1)", forHTTPHeaderField: "Range")
        session.dataTask(with: request) { data, response, _ in
            let waiters = file.waiting.removeValue(forKey: index) ?? []
            guard let http = response as? HTTPURLResponse, let data = data, http.statusCode == 200 || http.statusCode == 206 else {
                return waiters.forEach { $0(false) }
            }
            if let type = http.value(forHTTPHeaderField: "Content-Type") { file.type = self.inert(type) }
            if http.statusCode == 200 {
                // A site that ignores ranges sends the whole file: it is every block at once.
                file.total = data.count
                var offset = 0
                while offset < data.count {
                    let upper = min(offset + Self.block, data.count)
                    file.blocks[offset / Self.block] = data.subdata(in: offset..<upper)
                    offset = upper
                }
            } else {
                if file.total == nil, let range = http.value(forHTTPHeaderField: "Content-Range"),
                   let size = range.split(separator: "/").last.flatMap({ Int($0) }) {
                    file.total = size
                }
                file.blocks[index] = data
            }
            self.touch(file, index)
            self.keepIfWhole(file)
            waiters.forEach { $0(true) }
        }.resume()
    }

    /// The next few blocks after the one the player reached, fetched before it asks.
    private func readAhead(_ file: File, after index: Int, bearer: String) {
        guard let total = file.total else { return }
        for next in (index + 1)...(index + Self.ahead) where next * Self.block < total {
            if file.blocks[next] == nil, file.waiting[next] == nil {
                fetch(file, index: next, bearer: bearer) { _ in }
            }
        }
    }

    private func touch(_ file: File, _ index: Int) {
        file.used.removeAll { $0 == index }
        file.used.append(index)
        // Past the cap, the block used longest ago goes first.
        while file.used.count > Self.keepBlocks {
            file.blocks.removeValue(forKey: file.used.removeFirst())
        }
    }

    private func assemble(_ file: File, from start: Int, to end: Int) -> Data? {
        var body = Data(capacity: end - start + 1)
        var position = start
        while position <= end {
            let index = position / Self.block
            guard let block = file.blocks[index] else { return nil }
            let offset = position - index * Self.block
            let take = min(block.count - offset, end - position + 1)
            // A block shorter than the file says would loop here forever.
            guard take > 0 else { return nil }
            let from = block.startIndex + offset
            body.append(block[from..<(from + take)])
            position += take
        }
        return body
    }

    /// A file read end to end goes to disk, where replays and seeks are answered at once.
    private func keepIfWhole(_ file: File) {
        guard let total = file.total else { return }
        let count = (total + Self.block - 1) / Self.block
        guard file.blocks.count == count else { return }
        // The blocks themselves, in order: joining them first would hold the file in memory twice.
        let parts = (0..<count).compactMap { file.blocks[$0] }
        guard parts.count == count else { return }
        // They also stay in memory until newer files push them out: a request landing before the
        // write finishes is answered from there rather than fetched again.
        let target = file.target
        disk.async {
            try? FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            // Written aside and moved in, so a request never reads a file still being written.
            let part = target.appendingPathExtension("part")
            guard FileManager.default.createFile(atPath: part.path, contents: nil),
                  let handle = try? FileHandle(forWritingTo: part) else { return }
            parts.forEach { handle.write($0) }
            try? handle.close()
            try? FileManager.default.removeItem(at: target)
            try? FileManager.default.moveItem(at: part, to: target)
        }
    }

    // MARK: - Ranges

    private struct Asked { let first: Int?; let last: Int?; let suffix: Int? }

    private static func parse(_ range: String?) -> Asked? {
        guard let range = range, range.hasPrefix("bytes=") else { return nil }
        let parts = range.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false).map { Int($0) }
        guard parts.count == 2 else { return nil }
        if let first = parts[0] { return Asked(first: first, last: parts[1], suffix: nil) }
        return Asked(first: nil, last: nil, suffix: parts[1])
    }

    private static func bounds(_ asked: Asked?, total: Int) -> (Int, Int)? {
        guard total > 0 else { return nil }
        guard let asked = asked else { return (0, total - 1) }
        if let suffix = asked.suffix { return (max(0, total - suffix), total - 1) }
        guard let first = asked.first, first < total else { return nil }
        return (first, min(asked.last ?? total - 1, total - 1))
    }

    // MARK: - Handing to WebKit (main thread)

    private func deliver(_ delivery: Delivery, status: Int, headers: [String: String], body: Data) {
        DispatchQueue.main.async {
            guard !delivery.stopped else { return }
            self.live.removeValue(forKey: ObjectIdentifier(delivery.scheme))
            let task = delivery.scheme
            task.didReceive(HTTPURLResponse(url: task.request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!)
            task.didReceive(body)
            task.didFinish()
        }
    }

    private func fail(_ delivery: Delivery, status: Int) {
        DispatchQueue.main.async {
            guard !delivery.stopped else { return }
            self.live.removeValue(forKey: ObjectIdentifier(delivery.scheme))
            self.fail(delivery.scheme, status: status)
        }
    }

    // A complete cached file answers Range itself: video seeking never touches the network.
    private func fromDisk(_ schemeTask: WKURLSchemeTask, file: URL, range: String?) {
        guard let data = try? Data(contentsOf: file, options: .mappedIfSafe) else { return fail(schemeTask, status: 500) }
        guard let (start, end) = Self.bounds(Self.parse(range), total: data.count) else { return fail(schemeTask, status: 416) }
        var headers = ["Content-Type": mime(for: file), "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1), "X-Content-Type-Options": "nosniff"]
        if range != nil { headers["Content-Range"] = "bytes \(start)-\(end)/\(data.count)" }
        let response = HTTPURLResponse(url: schemeTask.request.url!, statusCode: range == nil ? 200 : 206, httpVersion: "HTTP/1.1", headerFields: headers)!
        schemeTask.didReceive(response)
        // The file is mapped, not read: sent in slices, a range of a large video is never in memory at once.
        let slice = 1 << 20
        var offset = start
        while offset <= end {
            let upper = min(offset + slice, end + 1)
            schemeTask.didReceive(offset == 0 && upper == data.count ? data : data.subdata(in: offset..<upper))
            offset = upper
        }
        schemeTask.didFinish()
    }

    private func fail(_ schemeTask: WKURLSchemeTask, status: Int) {
        schemeTask.didReceive(HTTPURLResponse(url: schemeTask.request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: [:])!)
        schemeTask.didFinish()
    }

    private func mime(for file: URL) -> String {
        inert(UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream")
    }

    /// A site file never renders as a document here, whatever type the site reports.
    private func inert(_ contentType: String) -> String {
        let type = contentType.lowercased()
        return type.hasPrefix("text/html") || type.hasPrefix("application/xhtml+xml") ? "text/plain" : contentType
    }
}
