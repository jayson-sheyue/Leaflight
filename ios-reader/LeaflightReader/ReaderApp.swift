import UIKit
import WebKit
import Network

@main
final class ReaderAppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        config.delegateClass = ReaderSceneDelegate.self
        return config
    }
}

final class ReaderSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        window.rootViewController = ReaderController()
        window.backgroundColor = UIColor(red: 0.965, green: 0.961, blue: 0.941, alpha: 1)
        window.makeKeyAndVisible()
        self.window = window
    }
    func sceneWillResignActive(_ scene: UIScene) {
        (window?.rootViewController as? ReaderController)?.flush()
    }
}

final class ReaderController: UIViewController, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    private let bridge = ReaderBridge()
    private var web: WKWebView?
    private var server: LoopbackReader?
    private var origin = ""

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.965, green: 0.961, blue: 0.941, alpha: 1)
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .default()
        if let source = Bundle.main.url(forResource: "native-bridge", withExtension: "js"),
           let script = try? String(contentsOf: source) {
            configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        configuration.userContentController.add(self, name: "leaflight")
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.uiDelegate = self
        web.navigationDelegate = self
        web.translatesAutoresizingMaskIntoConstraints = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(web)
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: guide.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: guide.trailingAnchor),
            web.topAnchor.constraint(equalTo: guide.topAnchor),
            web.bottomAnchor.constraint(equalTo: guide.bottomAnchor)
        ])
        self.web = web
        bridge.web = web
        bridge.presenter = self
        guard let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") else {
            showMissing(guide)
            return
        }
        let server = LoopbackReader(root: page.deletingLastPathComponent())
        self.server = server
        server.start { [weak self] port in
            guard let self, let port else { self?.showMissing(guide); return }
            self.origin = "http://127.0.0.1:\(port)"
            self.web?.load(URL(string: self.origin + "/index.html")!)
        }
    }

    private func showMissing(_ guide: UILayoutGuide) {
        let label = UILabel()
        label.text = "The reader page could not start. Run node ios-reader/build.cjs."
        label.numberOfLines = 0
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 24),
            label.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -24),
            label.centerYAnchor.constraint(equalTo: guide.centerYAnchor)
        ])
    }

    func flush() {
        web?.evaluateJavaScript("typeof readerFlush === 'function' && readerFlush()", completionHandler: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "leaflight", message.frameInfo.isMainFrame, let body = message.body as? [String: Any] else { return }
        bridge.receive(body)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        guard frame.isMainFrame, prompt.hasPrefix("leaflight:") else { completionHandler(nil); return }
        completionHandler(bridge.ask(String(prompt.dropFirst("leaflight:".count)), defaultText ?? ""))
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let value = navigationAction.request.url?.absoluteString ?? ""
        decisionHandler(!origin.isEmpty && (value == origin || value.hasPrefix(origin + "/")) ? .allow : .cancel)
    }
}

/// Serves the bundled reader on 127.0.0.1 so IndexedDB and the EPUB worker have a secure page origin.
final class LoopbackReader {
    private let root: URL
    private let queue = DispatchQueue(label: "leaflight.reader.loopback")
    private var listener: NWListener?
    private var announced = false
    init(root: URL) { self.root = root.standardizedFileURL }
    func start(_ ready: @escaping (UInt16?) -> Void) {
        do {
            let parameters = NWParameters.tcp
            parameters.requiredInterfaceType = .loopback
            parameters.allowLocalEndpointReuse = true
            let listener = try NWListener(using: parameters, on: .any)
            listener.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
            listener.stateUpdateHandler = { [weak self] state in
                guard let self, !self.announced else { return }
                if case .ready = state, let port = listener.port?.rawValue {
                    self.announced = true
                    DispatchQueue.main.async { ready(port) }
                } else if case .failed = state {
                    self.announced = true
                    DispatchQueue.main.async { ready(nil) }
                }
            }
            self.listener = listener
            listener.start(queue: queue)
        } catch {
            DispatchQueue.main.async { ready(nil) }
        }
    }
    private func accept(_ connection: NWConnection) {
        connection.stateUpdateHandler = { [weak self] state in
            if case .ready = state {
                guard self?.isLoopback(connection) == true else { connection.cancel(); return }
                self?.read(connection, buffer: Data())
            }
            if case .failed = state { connection.cancel() }
        }
        connection.start(queue: queue)
    }
    private func isLoopback(_ connection: NWConnection) -> Bool {
        guard case .hostPort(let host, _)? = connection.currentPath?.remoteEndpoint else { return false }
        switch host {
        case .ipv4(let address): return String(describing: address) == "127.0.0.1"
        case .ipv6(let address): return String(describing: address) == "::1"
        default: return false
        }
    }
    private func read(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, complete, error in
            guard let self else { connection.cancel(); return }
            var next = buffer
            if let data { next.append(data) }
            if let marker = next.range(of: Data("\r\n\r\n".utf8)) {
                self.respond(connection, header: next.subdata(in: 0..<marker.lowerBound))
                return
            }
            if error != nil || complete || next.count > 8192 { connection.cancel(); return }
            self.read(connection, buffer: next)
        }
    }
    private func respond(_ connection: NWConnection, header: Data) {
        let line = String(data: header, encoding: .utf8)?.split(separator: "\r\n").first.map(String.init) ?? ""
        let parts = line.split(separator: " ")
        guard parts.count >= 2, parts[0] == "GET" || parts[0] == "HEAD" else { connection.cancel(); return }
        var target = String(parts[1])
        if let query = target.firstIndex(of: "?") { target = String(target[..<query]) }
        let decoded = target.removingPercentEncoding ?? target
        guard decoded.hasPrefix("/"), !decoded.contains("\\"), !decoded.contains("\0"), !decoded.split(separator: "/").contains("..") else { connection.cancel(); return }
        let relative = decoded == "/" ? "index.html" : String(decoded.dropFirst())
        let file = root.appendingPathComponent(relative).standardizedFileURL
        let rootPath = root.path
        let filePath = file.path
        let body = (filePath == rootPath || filePath.hasPrefix(rootPath + "/")) ? (try? Data(contentsOf: file)) : nil
        let status = body == nil ? "404 Not Found" : "200 OK"
        let bytes = body ?? Data()
        let type = mime(file.pathExtension)
        let head = parts[0] == "HEAD"
        var response = "HTTP/1.1 \(status)\r\nContent-Type: \(type)\r\nContent-Length: \(bytes.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n"
        var payload = Data(response.utf8)
        if !head && body != nil { payload.append(bytes) }
        connection.send(content: payload, completion: .contentProcessed { _ in connection.cancel() })
    }
    private func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "map": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }
}
