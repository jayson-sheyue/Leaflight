package local.leaflight.reader;

public final class GeminiGatewayTest {
    private static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    private static void rejects(Runnable action) {
        try { action.run(); throw new AssertionError("accepted invalid input"); }
        catch (IllegalArgumentException expected) { }
    }
    public static void main(String[] args) {
        for (String key : new String[]{"AIzaSynthetic1234567890", "AQ.synthetic.auth.key_1234567890"}) {
            for (String provider : new String[]{"gemini", "vertex-express"}) {
                GeminiGateway gateway = new GeminiGateway(" " + key + " ", provider);
                String expected = provider.equals("gemini")
                    ? "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent"
                    : "https://aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-test:generateContent";
                check(gateway.endpoint("models/gemini-test").equals(expected));
                check(gateway.apiKey.equals(key)); check(!gateway.endpoint("test").contains(key));
            }
        }
        check(new GeminiGateway("AQ.synthetic", null).provider.equals("gemini"));
        rejects(() -> new GeminiGateway("key", "auto"));
        rejects(() -> new GeminiGateway("key\nother", "gemini"));
        rejects(() -> new GeminiGateway("", "gemini"));
        rejects(() -> new GeminiGateway("key", "gemini").endpoint("../other"));
        rejects(() -> new GeminiGateway("key", "gemini").endpoint("x?key=other"));
        GeminiGateway session = new GeminiGateway("old-key", "vertex-express");
        new GeminiGateway("new-key", "gemini");
        check(session.provider.equals("vertex-express") && session.apiKey.equals("old-key"));
        System.out.println("PASS: native gateway key formats, explicit routing, immutable session, normalized model and validation.");
    }
}
