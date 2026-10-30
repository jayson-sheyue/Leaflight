package local.leaflight.reader;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ConcurrentHashMap;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.io.ByteArrayOutputStream;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.content.ClipData;
import android.content.ClipboardManager;
import org.json.JSONArray;
import org.json.JSONObject;

/** Local reader shell. Gemini requests use a fixed HTTPS endpoint in native code. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int OPEN_FILE = 301, SAVE_FILE = 302;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] exportBytes;
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final ConcurrentHashMap<String, HttpsURLConnection> requests = new ConcurrentHashMap<>();
    private volatile boolean destroyed;
    private final ConcurrentHashMap<String, String> generationSessions = new ConcurrentHashMap<>();
    private final java.util.Set<String> pendingRequests = ConcurrentHashMap.newKeySet();
    private final java.util.Set<String> cancelledRequests = ConcurrentHashMap.newKeySet();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(246, 245, 240));
        web = new WebView(this);
        frame.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        if (Build.VERSION.SDK_INT >= 30) {
            frame.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true); // Only user-picked SAF documents, delivered through the file chooser.
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        web.addJavascriptInterface(new ExportBridge(), "ReaderNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && path != null && path.startsWith("/assets/") && !path.contains("..") && !path.contains("\\") && path.indexOf(0) < 0) {
                    String name = path.substring("/assets/".length());
                    try {
                        InputStream stream = getAssets().open("web/" + name);
                        String mime = name.endsWith(".html") ? "text/html" : name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : "application/octet-stream";
                        return new WebResourceResponse(mime, "UTF-8", 200, "OK", Collections.singletonMap("X-Content-Type-Options", "nosniff"), stream);
                    } catch (Exception ignored) { }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().equals(ORIGIN + "/assets/index.html");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "application/octet-stream", "text/plain", "application/epub+zip"});
                try { startActivityForResult(intent, OPEN_FILE); }
                catch (Exception e) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setNegativeButton(android.R.string.cancel, (d, w) -> result.cancel())
                    .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
                    .setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
        });
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::back);
        web.loadUrl(ORIGIN + "/assets/index.html");
    }
    private void back() {
        web.evaluateJavascript("typeof readerBack === 'function' && readerBack()", result -> {
            if (!"true".equals(result)) finish();
        });
    }
    @Override public void onBackPressed() { back(); }
    @Override protected void onPause() {
        web.evaluateJavascript("typeof readerFlush === 'function' && readerFlush()", null);
        super.onPause();
    }
    private void report(String result) {
        runOnUiThread(() -> { if (!isFinishing()) web.evaluateJavascript("window.readerExportResult && window.readerExportResult(" + JSONObject.quote(result) + ")", null); });
    }
    private final class ExportBridge {
        private SecretKey key(boolean create) throws Exception {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
            SecretKey existing = (SecretKey) store.getKey("leaflight-gemini", null);
            if (existing != null || !create) return existing;
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder("leaflight-gemini", KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            return generator.generateKey();
        }
        @JavascriptInterface public synchronized boolean saveKey(String value) {
            if (value == null || value.trim().isEmpty() || value.length() > 1024) return false;
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key(true));
                String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
                String encrypted = Base64.encodeToString(cipher.doFinal(value.trim().getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
                return getSharedPreferences("gemini", MODE_PRIVATE).edit().putString("iv", iv).putString("key", encrypted).commit();
            } catch (Exception ignored) { return false; }
        }
        @JavascriptInterface public synchronized boolean hasKey() { return readKey() != null; }
        @JavascriptInterface public synchronized void removeKey() {
            getSharedPreferences("gemini", MODE_PRIVATE).edit().clear().commit();
            try { KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); store.deleteEntry("leaflight-gemini"); } catch (Exception ignored) { }
        }
        private synchronized String readKey() {
            try {
                android.content.SharedPreferences p = getSharedPreferences("gemini", MODE_PRIVATE);
                SecretKey secret = key(false); if (secret == null || !p.contains("iv") || !p.contains("key")) return null;
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, secret, new GCMParameterSpec(128, Base64.decode(p.getString("iv", ""), Base64.NO_WRAP)));
                return new String(cipher.doFinal(Base64.decode(p.getString("key", ""), Base64.NO_WRAP)), StandardCharsets.UTF_8);
            } catch (Exception ignored) { return null; }
        }
        @JavascriptInterface public boolean beginGeneration(String id) {
            if (id == null || !id.matches("[a-zA-Z0-9-]{1,80}") || destroyed) return false;
            String secret = readKey(); if (secret == null) return false;
            generationSessions.put(id, secret); return true;
        }
        @JavascriptInterface public void endGeneration(String id) { if (id != null) generationSessions.remove(id); }
        @JavascriptInterface public void cancelGeneration(String id) {
            if (id == null || !id.matches("[a-zA-Z0-9-]{1,80}")) return;
            if (!pendingRequests.contains(id)) return;
            cancelledRequests.add(id);
            HttpsURLConnection connection = requests.get(id);
            if (connection != null) connection.disconnect();
        }
        @JavascriptInterface public void generate(String id, String model, String body, String session) {
            if (id == null || !id.matches("[a-zA-Z0-9-]{1,80}") || model == null || !model.matches("[a-zA-Z0-9._-]{1,100}") || body == null || body.length() > 500000) { generationResult(id, "invalid", ""); return; }
            final String secret = session == null ? null : generationSessions.get(session);
            if (secret == null) { generationResult(id, "no-key", ""); return; }
            pendingRequests.add(id);
            network.execute(() -> {
                HttpsURLConnection connection = null;
                try {
                    if (destroyed || cancelledRequests.contains(id) || !generationSessions.containsKey(session)) return;
                    connection = (HttpsURLConnection) new URL("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent").openConnection();
                    requests.put(id, connection);
                    if (destroyed || cancelledRequests.contains(id) || !generationSessions.containsKey(session)) return;
                    connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(20000); connection.setReadTimeout(120000);
                    connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setUseCaches(false);
                    connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("x-goog-api-key", secret);
                    try (OutputStream out = connection.getOutputStream()) { out.write(body.getBytes(StandardCharsets.UTF_8)); }
                    int status = connection.getResponseCode();
                    if (status != 200) { generationResult(id, "http-" + status, ""); return; }
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    try (InputStream in = connection.getInputStream()) {
                        byte[] buffer = new byte[8192]; int count;
                        while ((count = in.read(buffer)) != -1) { if (bytes.size() + count > 2 * 1024 * 1024) throw new java.io.IOException(); bytes.write(buffer, 0, count); }
                    }
                    generationResult(id, "ok", bytes.toString("UTF-8"));
                } catch (Exception ignored) { generationResult(id, "network", ""); }
                finally { requests.remove(id); pendingRequests.remove(id); cancelledRequests.remove(id); if (connection != null) connection.disconnect(); }
            });
        }
        @JavascriptInterface public void exportBackup(String json) {
            exportDocument("Leaflight-Reader-backup.json", json);
        }
        @JavascriptInterface public void exportStory(String filename, String json) {
            String safeName = (filename != null && filename.matches("[a-zA-Z0-9._-]{3,120}\\.json")) ? filename : "story.leaflight-story.json";
            exportDocument(safeName, json);
        }
        private void exportDocument(String title, String json) {
            if (json == null || json.length() > 30 * 1024 * 1024) { report("failed"); return; }
            runOnUiThread(() -> {
                if (exportBytes != null || isFinishing()) { report("failed"); return; }
                exportBytes = json.getBytes(StandardCharsets.UTF_8);
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, title);
                try { startActivityForResult(intent, SAVE_FILE); }
                catch (Exception e) { exportBytes = null; report("failed"); }
            });
        }
        @JavascriptInterface public boolean copyAndOpenUrl(String text, String url) {
            runOnUiThread(() -> {
                try {
                    if (text != null && !text.isEmpty()) {
                        ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                        if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Leaflight Story Pool", text));
                    }
                    if (url != null && url.startsWith("https://github.com/")) {
                        Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(browser);
                    }
                } catch (Exception ignored) { }
            });
            return true;
        }
        @JavascriptInterface public void fetchPool(String repo) {
            final String safeRepo = (repo != null && repo.matches("[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+")) ? repo : "jayson-sheyue/Leaflight";
            network.execute(() -> {
                if (destroyed) return;
                boolean online = false;
                JSONArray stories = new JSONArray();
                JSONArray issues = new JSONArray();
                try {
                    String indexText = readHttps("https://raw.githubusercontent.com/" + safeRepo + "/main/community-pool/index.json");
                    if (indexText != null) {
                        online = true;
                        JSONArray entries = indexText.trim().startsWith("[") ? new JSONArray(indexText) : new JSONObject(indexText).optJSONArray("stories");
                        if (entries != null) {
                            int limit = Math.min(entries.length(), 40);
                            for (int i = 0; i < limit; i++) {
                                JSONObject entry = entries.optJSONObject(i);
                                if (entry == null) continue;
                                if (entry.has("chapters")) { stories.put(entry); continue; }
                                String path = entry.optString("path", "");
                                if (path.matches("community-pool/stories/[a-zA-Z0-9._-]+\\.json")) {
                                    String storyText = readHttps("https://raw.githubusercontent.com/" + safeRepo + "/main/" + path);
                                    if (storyText != null) stories.put(new JSONObject(storyText));
                                }
                            }
                        }
                    }
                } catch (Exception ignored) { }
                try {
                    String issuesText = readHttps("https://api.github.com/repos/" + safeRepo + "/issues?state=open&per_page=30");
                    if (issuesText != null) {
                        online = true;
                        JSONArray arr = new JSONArray(issuesText);
                        for (int i = 0; i < arr.length(); i++) {
                            JSONObject iss = arr.optJSONObject(i);
                            if (iss != null && !iss.has("pull_request")) issues.put(iss);
                        }
                    }
                } catch (Exception ignored) { }
                try {
                    JSONObject payload = new JSONObject().put("stories", stories).put("issues", issues);
                    poolResult(online ? "ok" : "offline", payload.toString());
                } catch (Exception ignored) { poolResult("offline", "{}"); }
            });
        }
        private String readHttps(String urlStr) {
            HttpsURLConnection conn = null;
            try {
                conn = (HttpsURLConnection) new URL(urlStr).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(15000);
                conn.setRequestMethod("GET");
                conn.setUseCaches(false);
                conn.setRequestProperty("Accept", "application/vnd.github+json, application/json");
                conn.setRequestProperty("User-Agent", "Leaflight-Reader-Android");
                if (conn.getResponseCode() != 200) return null;
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream in = conn.getInputStream()) {
                    byte[] buf = new byte[8192]; int count;
                    while ((count = in.read(buf)) != -1) {
                        if (bytes.size() + count > 2 * 1024 * 1024) return null;
                        bytes.write(buf, 0, count);
                    }
                }
                return bytes.toString("UTF-8");
            } catch (Exception e) { return null; }
            finally { if (conn != null) conn.disconnect(); }
        }
    }
    private void poolResult(String status, String payload) {
        runOnUiThread(() -> { if (!destroyed && !isFinishing()) web.evaluateJavascript("window.readerPoolResult && window.readerPoolResult(" + JSONObject.quote(status) + "," + JSONObject.quote(payload) + ")", null); });
    }
    private void generationResult(String id, String status, String response) {
        runOnUiThread(() -> { if (!destroyed && !isFinishing()) web.evaluateJavascript("window.readerGenerationResult && window.readerGenerationResult(" + JSONObject.quote(id) + "," + JSONObject.quote(status) + "," + JSONObject.quote(response) + ")", null); });
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OPEN_FILE && fileCallback != null) {
            ValueCallback<Uri[]> callback = fileCallback;
            fileCallback = null;
            callback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
        } else if (request == SAVE_FILE) {
            byte[] bytes = exportBytes; exportBytes = null;
            if (result != RESULT_OK || data == null || data.getData() == null) { report("cancelled"); return; }
            Uri uri = data.getData();
            writer.execute(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null || bytes == null) throw new java.io.IOException();
                    out.write(bytes); out.flush(); report("saved");
                } catch (Exception e) {
                    // Do not leave a truncated document that looks like a usable backup.
                    try { android.provider.DocumentsContract.deleteDocument(getContentResolver(), uri); } catch (Exception ignored) { }
                    report("failed");
                }
            });
        }
    }
    @Override protected void onDestroy() {
        destroyed = true;
        generationSessions.clear();
        for (HttpsURLConnection connection : requests.values()) connection.disconnect();
        network.shutdownNow();
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        web.removeJavascriptInterface("ReaderNative"); web.destroy(); writer.shutdown();
        super.onDestroy();
    }
}
