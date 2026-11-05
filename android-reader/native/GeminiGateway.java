package local.leaflight.reader;

/** Immutable credentials for one generation session. Prefixes do not select a service. */
final class GeminiGateway {
    final String apiKey;
    final String provider;
    GeminiGateway(String value, String source) {
        apiKey = value == null ? "" : value.trim();
        if (apiKey.length() < 1 || apiKey.length() > 4096 || !apiKey.matches("[A-Za-z0-9._-]+")) throw new IllegalArgumentException("invalid-key");
        provider = provider(source);
    }
    static String provider(String value) {
        String source = value == null ? "gemini" : value;
        if (!source.equals("gemini") && !source.equals("vertex-express")) throw new IllegalArgumentException("invalid-provider");
        return source;
    }
    static String model(String value) {
        String id = value == null ? "" : value.trim();
        if (id.startsWith("models/")) id = id.substring(7);
        if (!id.matches("[a-zA-Z0-9._-]{1,100}")) throw new IllegalArgumentException("invalid-model");
        return id;
    }
    String endpoint(String value) {
        String base = provider.equals("vertex-express")
            ? "https://aiplatform.googleapis.com/v1beta1/publishers/google/models/"
            : "https://generativelanguage.googleapis.com/v1beta/models/";
        return base + model(value) + ":generateContent";
    }
}
