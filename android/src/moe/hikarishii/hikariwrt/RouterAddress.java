package moe.hikarishii.hikariwrt;

import android.net.Uri;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Where the router is: scheme, host and port, as typed on the setup screen.
 *
 * The user types what they would type into a browser - "10.10.0.1",
 * "192.168.1.1:8080", "https://router.lan" - so a missing scheme means http
 * (the router serves its web UI over plain HTTP) and anything after the host
 * is ignored: the app always opens /webui/ on it.
 */
final class RouterAddress {
    private static final Pattern IPV4 = Pattern.compile(
            "^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$");
    // A host name: labels of letters, digits and dashes, not starting or ending with a dash.
    private static final Pattern HOST = Pattern.compile(
            "^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$");

    final String scheme;
    final String host;
    /** -1 for the scheme's default. */
    final int port;

    RouterAddress(String scheme, String host, int port) {
        this.scheme = scheme.toLowerCase(Locale.ROOT);
        this.host = host.toLowerCase(Locale.ROOT);
        this.port = port;
    }

    /** What the user typed, or null when it isn't an address this app can use. */
    static RouterAddress parse(String input) {
        if (input == null) return null;
        String s = input.trim();
        if (s.isEmpty()) return null;
        if (!s.contains("://")) s = "http://" + s;
        Uri u = Uri.parse(s);
        String scheme = u.getScheme();
        String host = u.getHost();
        if (scheme == null || host == null) return null;
        if (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https")) return null;
        if (!IPV4.matcher(host).matches() && !HOST.matcher(host).matches()) return null;
        int port = u.getPort();
        if (port == 0 || port > 65535) return null;
        return new RouterAddress(scheme, host, port);
    }

    /** "http://10.10.0.1" or "https://router.lan:8443" - no trailing slash. */
    String base() {
        return scheme + "://" + host + (port > 0 ? ":" + port : "");
    }

    /** The web UI's address on the router. */
    String ui() {
        return base() + "/webui/";
    }

    /** How to show it on the setup screen: "10.10.0.1", or with the scheme when it isn't plain http. */
    String display() {
        return scheme.equals("http") ? host + (port > 0 ? ":" + port : "") : base();
    }

    boolean isHttps() {
        return scheme.equals("https");
    }

    private int effectivePort() {
        return port > 0 ? port : (isHttps() ? 443 : 80);
    }

    /** Same scheme, host and port: a page the router serves (the web UI, /cgi-bin/luci...). */
    boolean sameOrigin(Uri u) {
        if (u == null || u.getScheme() == null || u.getHost() == null) return false;
        String s = u.getScheme().toLowerCase(Locale.ROOT);
        int p = u.getPort() > 0 ? u.getPort() : (s.equals("https") ? 443 : 80);
        return s.equals(scheme) && u.getHost().toLowerCase(Locale.ROOT).equals(host) && p == effectivePort();
    }

    /** RFC 1918 IPv4 - where a router moved to a new LAN address will be. */
    static boolean isPrivateV4(String host) {
        if (host == null || !IPV4.matcher(host).matches()) return false;
        String[] o = host.split("\\.");
        int a = Integer.parseInt(o[0]), b = Integer.parseInt(o[1]);
        return a == 10 || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168);
    }
}
