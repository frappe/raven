import Foundation
import Capacitor
import SocketIO

/// socket.io client for the bundled page. The WebView cannot send the site as its
/// Origin, which Frappe's realtime server requires; a native client can.
@objc(RavenSocketPlugin)
public class RavenSocketPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RavenSocketPlugin"
    public let jsName = "RavenSocket"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "emit", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setToken", returnType: CAPPluginReturnPromise),
    ]

    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private var origin = ""
    private var siteName = ""
    private var hasConnected = false
    private var connectedTarget = ""

    @objc func connect(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("url required")
            return
        }
        let target = urlString + "/" + (call.getString("namespace") ?? "") + "@" + (call.getString("origin") ?? "")
        // Same target: a live socket only re-sends the connect event (a page loaded after it came up
        // needs that to flush its emits); a dead one restarts now instead of waiting out the backoff.
        if let socket = socket, target == connectedTarget {
            manager?.setConfigs([.extraHeaders(headers(call.getString("token") ?? ""))])
            if socket.status == .connected { notifyListeners("connect", data: [:]) }
            else { manager?.disconnect(); socket.connect() }
            call.resolve()
            return
        }
        close()
        connectedTarget = target
        hasConnected = false
        origin = call.getString("origin") ?? ""
        siteName = call.getString("namespace") ?? ""
        // Default reconnect waits (10 s, growing to 30 s) outlive the page's health check after a background.
        let manager = SocketManager(socketURL: url, config: [.log(false), .forceWebsockets(true), .reconnectWait(1), .reconnectWaitMax(5), .extraHeaders(headers(call.getString("token") ?? ""))])
        let socket = manager.socket(forNamespace: "/" + siteName)
        socket.on(clientEvent: .connect) { [weak self] _, _ in
            guard let self = self else { return }
            self.notifyListeners("connect", data: [:])
            // Swift's .reconnect fires when reconnecting starts; the manager's "reconnect" means it succeeded.
            if self.hasConnected { self.notifyListeners("reconnect", data: [:]) }
            self.hasConnected = true
        }
        socket.on(clientEvent: .disconnect) { [weak self] data, _ in self?.notifyListeners("disconnect", data: ["reason": "\(data.first ?? "")"]) }
        socket.on(clientEvent: .error) { [weak self] data, _ in
            CAPLog.print("RavenSocket: connect error: \(data)")
            self?.notifyListeners("connect_error", data: ["message": "\(data)"])
        }
        socket.onAny { [weak self] event in
            // onAny also reports the client's own lifecycle events; only server events are forwarded.
            if SocketClientEvent(rawValue: event.event) != nil { return }
            self?.notifyListeners("event", data: ["event": event.event, "args": event.items ?? []])
        }
        self.manager = manager
        self.socket = socket
        socket.connect()
        call.resolve()
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        close()
        call.resolve()
    }

    @objc func emit(_ call: CAPPluginCall) {
        if let socket = socket, let event = call.getString("event") {
            let items = (call.getArray("args") ?? []).compactMap { $0 as? SocketData }
            socket.emit(event, with: items, completion: nil)
        }
        call.resolve()
    }

    // The live connection stays authenticated; the next reconnect carries the new token.
    @objc func setToken(_ call: CAPPluginCall) {
        manager?.setConfigs([.extraHeaders(headers(call.getString("token") ?? ""))])
        call.resolve()
    }

    private func headers(_ token: String) -> [String: String] {
        // X-Frappe-Site-Name is what nginx sets in production: the site behind a host that is not the site name.
        ["Origin": origin, "Authorization": "Bearer \(token)", "X-Frappe-Site-Name": siteName]
    }

    private func close() {
        connectedTarget = ""
        socket?.removeAllHandlers()
        manager?.disconnect()
        socket = nil
        manager = nil
    }
}
