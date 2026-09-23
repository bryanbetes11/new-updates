package com.babcreations.servesync;

import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeImageCache")
public class NativeImageCachePlugin extends Plugin {
    private static final long MAX_FILE_BYTES = 5L * 1024L * 1024L;
    private static final long MAX_CACHE_BYTES = 480L * 1024L * 1024L;
    private static final long MAX_AGE_MS = 7L * 24L * 60L * 60L * 1000L;
    private final ExecutorService io = Executors.newFixedThreadPool(3);
    private final ExecutorService scopeIo = Executors.newSingleThreadExecutor();
    private final Object cacheLock = new Object();
    private String activeScope;
    private long generation;

    @PluginMethod
    public void setScope(PluginCall call) {
        String scope = call.getString("scope");
        if (scope != null && (scope.isEmpty() || scope.length() > 256)) {
            call.reject("Invalid image cache scope.");
            return;
        }
        final long requestedGeneration;
        synchronized (cacheLock) {
            activeScope = null;
            generation++;
            requestedGeneration = generation;
        }
        scopeIo.execute(() -> {
            try {
                synchronized (cacheLock) {
                    if (requestedGeneration != generation) {
                        call.resolve();
                        return;
                    }
                    // A scope switch revokes in-flight work. Other scopes stay on disk,
                    // inaccessible until that exact account and church signs in again.
                    activeScope = scope;
                    prune();
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Unable to set image cache scope.", error);
            }
        });
    }

    @PluginMethod
    public void clear(PluginCall call) {
        String scope = call.getString("scope");
        if (scope == null) {
            call.reject("An active image cache scope is required.");
            return;
        }
        final long requestedGeneration;
        synchronized (cacheLock) {
            if (!scope.equals(activeScope)) {
                call.reject("Image cache scope changed.");
                return;
            }
            activeScope = null;
            generation++;
            requestedGeneration = generation;
        }
        scopeIo.execute(() -> {
            try {
                synchronized (cacheLock) {
                    clearFilesForScope(hash(scope) + "_");
                    if (requestedGeneration == generation) activeScope = scope;
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Unable to clear image cache.", error);
            }
        });
    }

    @PluginMethod
    public void getImage(PluginCall call) {
        String scope = call.getString("scope");
        String address = call.getString("url");
        if (scope == null || address == null || !isHttps(address)) {
            call.reject("A signed-in scope and HTTPS image URL are required.");
            return;
        }
        io.execute(() -> {
            File temporary = null;
            try {
                long requestedGeneration;
                File directory = cacheDirectory();
                String cacheKey = hash(scope) + "_" + hash(address);
                synchronized (cacheLock) {
                    if (!scope.equals(activeScope)) throw new IOException("Image cache scope changed.");
                    requestedGeneration = generation;
                    prune();
                    File[] candidates = directory.listFiles();
                    if (candidates != null) for (File cached : candidates) {
                        long createdAt = createdAt(cached.getName());
                        if (cached.getName().startsWith(cacheKey + "-") && cached.isFile() && cached.length() > 0
                            && createdAt > 0 && System.currentTimeMillis() - createdAt <= MAX_AGE_MS) {
                            cached.setLastModified(System.currentTimeMillis());
                            resolveFile(call, cached);
                            return;
                        }
                    }
                }
                if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Unable to create image cache.");
                temporary = File.createTempFile("image-", ".tmp", directory);
                String extension = download(address, temporary);
                File cached = new File(directory, cacheKey + "-" + System.currentTimeMillis() + extension);
                synchronized (cacheLock) {
                    if (requestedGeneration != generation || !scope.equals(activeScope)) {
                        throw new IOException("Image cache scope changed.");
                    }
                    if (!cached.isFile()) {
                        if (!temporary.renameTo(cached)) throw new IOException("Unable to save image cache file.");
                        temporary = null;
                    }
                    cached.setLastModified(System.currentTimeMillis());
                    prune();
                    if (!cached.isFile()) throw new IOException("Image cache file was evicted.");
                    resolveFile(call, cached);
                }
            } catch (Exception error) {
                call.reject("Unable to cache image.", error);
            } finally {
                if (temporary != null) temporary.delete();
            }
        });
    }

    private void resolveFile(PluginCall call, File file) {
        JSObject result = new JSObject();
        result.put("uri", Uri.fromFile(file).toString());
        call.resolve(result);
    }

    private File cacheDirectory() {
        return new File(getContext().getFilesDir(), "native-image-cache");
    }

    private void clearFilesForScope(String prefix) throws IOException {
        File[] files = cacheDirectory().listFiles();
        if (files != null) for (File file : files) {
            if (file.getName().startsWith(prefix) && !file.delete()) throw new IOException("Unable to clear image cache file.");
        }
    }

    private void prune() throws IOException {
        File[] files = cacheDirectory().listFiles();
        if (files == null) return;
        long now = System.currentTimeMillis();
        long total = 0;
        for (File file : files) {
            if (file.getName().endsWith(".tmp")) {
                if (now - file.lastModified() > 2L * 60L * 1000L) file.delete();
                continue;
            }
            long createdAt = createdAt(file.getName());
            if (!file.isFile() || createdAt == 0 || file.length() > MAX_FILE_BYTES || now - createdAt > MAX_AGE_MS) {
                if (!file.delete() && file.isFile()) total += file.length();
            } else {
                total += file.length();
            }
        }
        if (total <= MAX_CACHE_BYTES) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (File file : files) {
            if (total <= MAX_CACHE_BYTES) break;
            if (!file.isFile() || file.getName().endsWith(".tmp")) continue;
            long size = file.length();
            if (file.delete()) total -= size;
        }
        if (total > MAX_CACHE_BYTES) throw new IOException("Image cache is full.");
    }

    private static long createdAt(String filename) {
        int separator = filename.lastIndexOf('-');
        int extension = filename.lastIndexOf('.');
        if (separator < 0 || extension < separator) return 0;
        try {
            long timestamp = Long.parseLong(filename.substring(separator + 1, extension));
            return timestamp > 0 && timestamp <= System.currentTimeMillis() ? timestamp : 0;
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String download(String address, File target) throws IOException {
        for (int redirect = 0; redirect < 4; redirect++) {
            if (!isHttps(address)) throw new IOException("Insecure image URL.");
            HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(12000);
            try {
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) throw new IOException("Missing redirect URL.");
                    address = new URL(new URL(address), location).toString();
                    continue;
                }
                if (status < 200 || status >= 300) throw new IOException("HTTP " + status);
                String mime = connection.getContentType();
                mime = mime == null ? "" : mime.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
                if (!Arrays.asList("image/jpeg", "image/png", "image/webp", "image/gif").contains(mime)) {
                    throw new IOException("Unsupported image type.");
                }
                if (connection.getContentLengthLong() > MAX_FILE_BYTES) throw new IOException("Image too large.");
                try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(target)) {
                    byte[] buffer = new byte[16 * 1024];
                    long total = 0;
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        total += count;
                        if (total > MAX_FILE_BYTES) throw new IOException("Image too large.");
                        output.write(buffer, 0, count);
                    }
                    if (total == 0) throw new IOException("Empty image.");
                }
                if (!matchesSignature(target, mime)) throw new IOException("Image content does not match its type.");
                if ("image/jpeg".equals(mime)) return ".jpg";
                if ("image/png".equals(mime)) return ".png";
                if ("image/gif".equals(mime)) return ".gif";
                return ".webp";
            } finally {
                connection.disconnect();
            }
        }
        throw new IOException("Too many redirects.");
    }

    private static boolean matchesSignature(File file, String mime) throws IOException {
        byte[] prefix = new byte[12];
        try (InputStream input = new FileInputStream(file)) {
            if (input.read(prefix) < 12) return false;
        }
        if ("image/jpeg".equals(mime)) return (prefix[0] & 0xff) == 0xff && (prefix[1] & 0xff) == 0xd8 && (prefix[2] & 0xff) == 0xff;
        if ("image/png".equals(mime)) return (prefix[0] & 0xff) == 0x89 && prefix[1] == 'P' && prefix[2] == 'N' && prefix[3] == 'G';
        if ("image/gif".equals(mime)) return prefix[0] == 'G' && prefix[1] == 'I' && prefix[2] == 'F' && prefix[3] == '8';
        return prefix[0] == 'R' && prefix[1] == 'I' && prefix[2] == 'F' && prefix[3] == 'F'
            && prefix[8] == 'W' && prefix[9] == 'E' && prefix[10] == 'B' && prefix[11] == 'P';
    }

    private static boolean isHttps(String address) {
        try {
            URL url = new URL(address);
            return "https".equalsIgnoreCase(url.getProtocol()) && url.getHost() != null && !url.getHost().isEmpty();
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String hash(String value) throws NoSuchAlgorithmException {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) result.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        return result.toString();
    }
}
