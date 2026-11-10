import UIKit
import WebKit

/// Keychain snapshot and fixed Google HTTPS calls. Prefixes do not choose the service.
final class ReaderBridge: NSObject, URLSessionDataDelegate, UIDocumentPickerDelegate {
    weak var web: WKWebView?
    weak var presenter: UIViewController?
    private let keyService = "local.leaflight.reader.ios"
    private var sessions: [String: (key: String, provider: String)] = [:]
    private var tasks: [String: URLSessionTask] = [:]
    private let slotLock = NSLock()
    private var slots: [Int: Slot] = [:]
    private var exportFile: URL?
    private var exportShareURL: String?
    private var exportBusy = false
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 130
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.waitsForConnectivity = false
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private struct Slot {
        var data = Data()
        var limit: Int
        var status = 0
        var completion: ((String, Data) -> Void)?
    }

    func ask(_ op: String, _ raw: String) -> String {
        let payload = jsonObject(raw)
        let value: Any
        switch op {
        case "hasKey": value = readSecret() != nil
        case "getGeminiProvider": value = provider(UserDefaults.standard.string(forKey: "gemini-provider"))
        case "saveKey": value = saveSettings(string(payload, "key"), provider(nil))
        case "saveGeminiSettings": value = saveSettings(string(payload, "key"), string(payload, "provider"))
        case "removeKey": removeSecret(); value = true
        case "beginGeneration": value = begin(string(payload, "id"))
        case "endGeneration": end(string(payload, "id")); value = true
        case "cancelGeneration": cancel(string(payload, "id")); value = true
        case "copyAndOpenUrl": value = copyAndOpen(string(payload, "text"), string(payload, "url"))
        default: value = false
        }
        return jsonReply(value)
    }

    func receive(_ body: [String: Any]) {
        switch body["op"] as? String {
        case "generate": generate(string(body, "id"), string(body, "model"), string(body, "body"), string(body, "session"))
        case "exportBackup": exportDocument(name: "Leaflight-Reader-backup.json", json: string(body, "json"), share: nil)
        case "exportStory":
            let name = string(body, "filename")
            let safe = name.range(of: #"^[a-zA-Z0-9._-]{3,120}\.json$"#, options: .regularExpression) == nil ? "story.leaflight-story.json" : name
            exportDocument(name: safe, json: string(body, "json"), share: nil)
        case "prepareSharePackage": prepareShare(string(body, "filename"), string(body, "json"), string(body, "url"))
        case "fetchPool": fetchPool(string(body, "repo"))
        case "fetchPoolStory": fetchStory(string(body, "id"), string(body, "poolId"))
        default: break
        }
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        mutateSlot(dataTask.taskIdentifier) { $0.status = (response as? HTTPURLResponse)?.statusCode ?? 0 }
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        var tooLarge = false
        mutateSlot(dataTask.taskIdentifier) {
            if $0.data.count + data.count > $0.limit { tooLarge = true } else { $0.data.append(data) }
        }
        if tooLarge { dataTask.cancel() }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        slotLock.lock()
        let slot = slots.removeValue(forKey: task.taskIdentifier)
        slotLock.unlock()
        guard let slot else { return }
        let state = error == nil && slot.status == 200 ? "ok" : (error == nil && slot.status > 0 ? "http-\(slot.status)" : "network")
        let bytes = state == "ok" ? slot.data : Data()
        DispatchQueue.main.async { slot.completion?(state, bytes) }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        finishExport(exportShareURL == nil ? "saved" : "share-saved")
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        finishExport("cancelled")
    }

    private func begin(_ id: String) -> Bool {
        guard id.range(of: #"^[a-zA-Z0-9-]{1,80}$"#, options: .regularExpression) != nil, let secret = readSecret() else { return false }
        guard let key = try? validateKey(secret.key), let source = try? validateProvider(secret.provider) else { return false }
        sessions[id] = (key, source)
        return true
    }

    private func end(_ id: String) { sessions.removeValue(forKey: id) }

    private func cancel(_ id: String) {
        guard id.range(of: #"^[a-zA-Z0-9-]{1,80}$"#, options: .regularExpression) != nil else { return }
        tasks[id]?.cancel()
    }

    private func generate(_ id: String, _ model: String, _ body: String, _ sessionId: String) {
        guard id.range(of: #"^[a-zA-Z0-9-]{1,80}$"#, options: .regularExpression) != nil,
              model.range(of: #"^[a-zA-Z0-9._-]{1,100}$"#, options: .regularExpression) != nil,
              body.utf8.count <= 500_000, let config = sessions[sessionId] else {
            generation(id, configMissing: sessions[sessionId] == nil && id.range(of: #"^[a-zA-Z0-9-]{1,80}$"#, options: .regularExpression) != nil)
            return
        }
        guard let endpoint = URL(string: endpointURL(config.provider, model)), let bytes = body.data(using: .utf8) else { generation(id, status: "invalid", response: ""); return }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(config.key, forHTTPHeaderField: "x-goog-api-key")
        request.httpBody = bytes
        let task = session.dataTask(with: request)
        storeSlot(task.taskIdentifier, Slot(limit: 2 * 1024 * 1024) { [weak self] state, data in
            self?.tasks.removeValue(forKey: id)
            let text = state == "ok" ? String(data: data, encoding: .utf8) ?? "" : ""
            self?.generation(id, status: state, response: text)
        })
        tasks[id] = task
        task.resume()
    }

    private func fetchPool(_ repo: String) {
        let safe = repo.range(of: #"^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$"#, options: .regularExpression) == nil ? "jayson-sheyue/Leaflight" : repo
        get("https://raw.githubusercontent.com/\(safe)/main/community-pool/index.json", limit: 8 * 1024 * 1024) { [weak self] index in
            if let index, let stories = self?.stories(from: index) {
                self?.pool(online: true, stories: stories, issues: [])
                return
            }
            self?.get("https://api.github.com/repos/\(safe)/issues?state=open&per_page=30", limit: 8 * 1024 * 1024) { issuesText in
                let issues = self?.issues(from: issuesText) ?? []
                self?.pool(online: issuesText != nil, stories: [], issues: issues)
            }
        }
    }

    private func fetchStory(_ id: String, _ poolId: String) {
        guard id.range(of: #"^[a-zA-Z0-9-]{1,100}$"#, options: .regularExpression) != nil,
              poolId.range(of: #"^[a-z0-9][a-z0-9._-]{2,80}$"#, options: .regularExpression) != nil else { return }
        get("https://raw.githubusercontent.com/jayson-sheyue/Leaflight/main/community-pool/stories/\(poolId).json", limit: 30 * 1024 * 1024) { [weak self] text in
            self?.emit("window.readerPoolStoryResult && window.readerPoolStoryResult(\(js(id)),\(js(text == nil ? "failed" : "ok")),\(js(text ?? "")))")
        }
    }

    private func get(_ url: String, limit: Int, done: @escaping (String?) -> Void) {
        guard let target = URL(string: url) else { done(nil); return }
        var request = URLRequest(url: target)
        request.httpMethod = "GET"
        request.setValue("application/vnd.github+json, application/json", forHTTPHeaderField: "Accept")
        request.setValue("Leaflight-Reader-iOS", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15
        let task = session.dataTask(with: request)
        storeSlot(task.taskIdentifier, Slot(limit: limit) { state, data in
            done(state == "ok" ? String(data: data, encoding: .utf8) : nil)
        })
        task.resume()
    }

    private func prepareShare(_ filename: String, _ json: String, _ url: String) {
        guard json.utf8.count <= 30 * 1024 * 1024,
              filename.range(of: #"^[a-zA-Z0-9._-]{3,120}\.zip$"#, options: .regularExpression) != nil,
              url.hasPrefix("https://github.com/jayson-sheyue/Leaflight/issues/new?") else { report("failed"); return }
        guard let source = json.data(using: .utf8) else { report("failed"); return }
        let zipped = StoredZip.archive(name: "story.leaflight-story.json", data: source)
        guard zipped.count <= 25 * 1024 * 1024 else { report("failed"); return }
        presentExport(name: filename, data: zipped, share: url)
    }

    private func exportDocument(name: String, json: String, share: String?) {
        guard json.utf8.count <= 30 * 1024 * 1024, let data = json.data(using: .utf8) else { report("failed"); return }
        presentExport(name: name, data: data, share: share)
    }

    private func presentExport(name: String, data: Data, share: String?) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.presenter else { self?.report("failed"); return }
            if self.exportBusy { self.report("failed"); return }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            do { try data.write(to: url, options: .atomic) } catch { self.report("failed"); return }
            self.exportBusy = true
            self.exportFile = url
            self.exportShareURL = share
            let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    private func finishExport(_ status: String) {
        let share = exportShareURL
        if let file = exportFile { try? FileManager.default.removeItem(at: file) }
        exportFile = nil
        exportShareURL = nil
        exportBusy = false
        report(status)
        if status == "share-saved", let share, let url = URL(string: share), share.hasPrefix("https://github.com/jayson-sheyue/Leaflight/issues/new?") {
            UIApplication.shared.open(url)
        }
    }

    private func pool(online: Bool, stories: [[String: Any]], issues: [[String: Any]]) {
        let payload: [String: Any] = ["stories": stories, "issues": issues]
        let text = (try? String(data: JSONSerialization.data(withJSONObject: payload), encoding: .utf8)) ?? "{}"
        emit("window.readerPoolResult && window.readerPoolResult(\(js(online ? "ok" : "offline")),\(js(text)))")
    }

    private func stories(from text: String) -> [[String: Any]]? {
        guard let data = text.data(using: .utf8), let json = try? JSONSerialization.jsonObject(with: data) else { return nil }
        let entries: [Any]
        if let array = json as? [Any] { entries = array }
        else if let object = json as? [String: Any], let array = object["stories"] as? [Any] { entries = array }
        else { return nil }
        return entries.prefix(1000).compactMap { $0 as? [String: Any] }
    }

    private func issues(from text: String?) -> [[String: Any]] {
        guard let text, let data = text.data(using: .utf8), let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return [] }
        return array.filter { $0["pull_request"] == nil }
    }

    private func generation(_ id: String, configMissing: Bool) {
        generation(id, status: configMissing ? "no-key" : "invalid", response: "")
    }

    private func generation(_ id: String, status: String, response: String) {
        emit("window.readerGenerationResult && window.readerGenerationResult(\(js(id)),\(js(status)),\(js(response)))")
    }

    private func storeSlot(_ id: Int, _ slot: Slot) {
        slotLock.lock(); slots[id] = slot; slotLock.unlock()
    }

    private func mutateSlot(_ id: Int, _ body: (inout Slot) -> Void) {
        slotLock.lock()
        if var slot = slots[id] { body(&slot); slots[id] = slot }
        slotLock.unlock()
    }

    private func report(_ status: String) {
        emit("window.readerExportResult && window.readerExportResult(\(js(status)))")
    }

    private func emit(_ script: String) {
        DispatchQueue.main.async { [weak self] in self?.web?.evaluateJavaScript(script, completionHandler: nil) }
    }

    private func saveSettings(_ key: String, _ source: String) -> Bool {
        guard let provider = try? validateProvider(source) else { return false }
        if key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            UserDefaults.standard.set(provider, forKey: "gemini-provider")
            return true
        }
        guard let secret = try? validateKey(key) else { return false }
        return writeSecret(secret, provider)
    }

    private func validateProvider(_ value: String) throws -> String {
        let source = value.isEmpty ? "gemini" : value
        guard source == "gemini" || source == "vertex-express" else { throw CocoaError(.coderInvalidValue) }
        return source
    }

    private func validateKey(_ value: String) throws -> String {
        let key = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...4096).contains(key.count), key.range(of: #"^[A-Za-z0-9._-]+$"#, options: .regularExpression) != nil else { throw CocoaError(.coderInvalidValue) }
        return key
    }

    private func provider(_ value: String?) -> String { (try? validateProvider(value ?? "gemini")) ?? "gemini" }

    private func endpointURL(_ provider: String, _ model: String) -> String {
        let base = provider == "vertex-express"
            ? "https://aiplatform.googleapis.com/v1beta1/publishers/google/models/"
            : "https://generativelanguage.googleapis.com/v1beta/models/"
        let id = model.hasPrefix("models/") ? String(model.dropFirst(7)) : model
        return base + id + ":generateContent"
    }

    private func writeSecret(_ key: String, _ provider: String) -> Bool {
        let payload = try? JSONSerialization.data(withJSONObject: ["key": key, "provider": provider])
        guard let payload else { return false }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keyService, kSecAttrAccount as String: "gemini"]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = payload
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let saved = SecItemAdd(add as CFDictionary, nil) == errSecSuccess
        if saved { UserDefaults.standard.set(provider, forKey: "gemini-provider") }
        return saved
    }

    private func readSecret() -> (key: String, provider: String)? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keyService, kSecAttrAccount as String: "gemini", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: String],
              let key = object["key"], let provider = object["provider"] else { return nil }
        return (key, provider)
    }

    private func removeSecret() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keyService, kSecAttrAccount as String: "gemini"]
        SecItemDelete(query as CFDictionary)
        UserDefaults.standard.removeObject(forKey: "gemini-provider")
        sessions.removeAll()
    }

    private func copyAndOpen(_ text: String, _ url: String) -> Bool {
        DispatchQueue.main.async {
            if !text.isEmpty { UIPasteboard.general.string = text }
            if url.hasPrefix("https://github.com/"), let target = URL(string: url) { UIApplication.shared.open(target) }
        }
        return true
    }

    private func string(_ object: [String: Any], _ key: String) -> String { object[key] as? String ?? "" }

    private func jsonObject(_ raw: String) -> [String: Any] {
        guard let data = raw.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return object
    }

    private func jsonReply(_ value: Any) -> String {
        let data = try? JSONSerialization.data(withJSONObject: ["value": value])
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? #"{"value":false}"#
    }

    private func js(_ value: String) -> String {
        (try? String(data: JSONEncoder().encode(value), encoding: .utf8)) ?? "\"\""
    }
}

enum StoredZip {
    static func archive(name: String, data: Data) -> Data {
        let nameBytes = Data(name.utf8)
        let crc = crc32(data)
        var local = Data()
        local.append(le(0x04034b50))
        local.append(le16(20)); local.append(le16(0)); local.append(le16(0)); local.append(le16(0)); local.append(le16(0))
        local.append(le(crc)); local.append(le(UInt32(data.count))); local.append(le(UInt32(data.count)))
        local.append(le16(UInt16(nameBytes.count))); local.append(le16(0))
        local.append(nameBytes); local.append(data)
        var central = Data()
        central.append(le(0x02014b50))
        central.append(le16(20)); central.append(le16(20)); central.append(le16(0)); central.append(le16(0)); central.append(le16(0)); central.append(le16(0))
        central.append(le(crc)); central.append(le(UInt32(data.count))); central.append(le(UInt32(data.count)))
        central.append(le16(UInt16(nameBytes.count))); central.append(le16(0)); central.append(le16(0)); central.append(le16(0)); central.append(le16(0))
        central.append(le(0)); central.append(le(0))
        central.append(nameBytes)
        var end = Data()
        end.append(le(0x06054b50))
        end.append(le16(0)); end.append(le16(0)); end.append(le16(1)); end.append(le16(1))
        end.append(le(UInt32(central.count))); end.append(le(UInt32(local.count))); end.append(le16(0))
        return local + central + end
    }

    private static func crc32(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xffffffff
        for byte in data {
            crc ^= UInt32(byte)
            for _ in 0..<8 { crc = (crc & 1) == 1 ? (crc >> 1) ^ 0xedb88320 : crc >> 1 }
        }
        return ~crc
    }

    private static func le(_ value: UInt32) -> Data { var n = value.littleEndian; return withUnsafeBytes(of: &n) { Data($0) } }
    private static func le16(_ value: UInt16) -> Data { var n = value.littleEndian; return withUnsafeBytes(of: &n) { Data($0) } }
}
