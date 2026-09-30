package moe.hikarishii.hikariwrt;

import android.content.Context;
import android.content.SharedPreferences;

import java.security.MessageDigest;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Locale;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * Accept-once certificates for a router on HTTPS.
 *
 * A router's certificate is self-signed (uhttpd makes one with px5g), so no
 * CA vouches for it. The user sees its SHA-256 fingerprint once and accepts
 * it; from then on exactly that certificate is trusted for that host, and a
 * different one - a reflashed router, or someone in the middle - is asked
 * about again rather than silently accepted. Plain http needs none of this.
 */
final class Pins {
    private final SharedPreferences prefs;

    Pins(Context c) {
        prefs = c.getSharedPreferences("pins", Context.MODE_PRIVATE);
    }

    static String sha256(X509Certificate cert) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(cert.getEncoded());
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < d.length; i++) {
                if (i > 0) sb.append(':');
                sb.append(String.format(Locale.ROOT, "%02X", d[i]));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    boolean matches(String host, X509Certificate cert) {
        String want = prefs.getString(host, null);
        return want != null && !want.isEmpty() && want.equals(sha256(cert));
    }

    void pin(String host, X509Certificate cert) {
        prefs.edit().putString(host, sha256(cert)).apply();
    }

    /** Thrown by the trust manager when the router's certificate isn't the pinned one. */
    static final class Untrusted extends CertificateException {
        final X509Certificate cert;

        Untrusted(X509Certificate cert) {
            super("certificate not trusted yet");
            this.cert = cert;
        }
    }

    /**
     * Make an HTTPS connection to `host` trust only its pinned certificate.
     * An unpinned or different certificate fails the handshake with Untrusted
     * (as the cause), which carries the certificate so the user can be asked.
     */
    void apply(HttpsURLConnection c, final String host) {
        final Pins self = this;
        X509TrustManager tm = new X509TrustManager() {
            @Override
            public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                throw new CertificateException("not a server");
            }

            @Override
            public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                if (chain == null || chain.length == 0) throw new CertificateException("no certificate");
                if (!self.matches(host, chain[0])) throw new Untrusted(chain[0]);
            }

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                return new X509Certificate[0];
            }
        };
        try {
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[] {tm}, null);
            SSLSocketFactory f = ctx.getSocketFactory();
            c.setSSLSocketFactory(f);
            // The pin is the identity: a router's certificate names whatever px5g
            // put in it, rarely the address it is reached at.
            HostnameVerifier hv = (h, session) -> h.equalsIgnoreCase(host);
            c.setHostnameVerifier(hv);
        } catch (Exception e) {
            // leave the platform defaults; the handshake then fails as untrusted
        }
    }
}
