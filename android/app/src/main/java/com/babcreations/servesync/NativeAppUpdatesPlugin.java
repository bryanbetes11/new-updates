package com.babcreations.servesync;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
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
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "NativeAppUpdates")
public class NativeAppUpdatesPlugin extends Plugin {
    private static final long MAX_BYTES = 100L * 1024L * 1024L;
    private static final Pattern RELEASE_URL = Pattern.compile(
        "^https://github\\.com/bryanbetes11/new-updates/releases/download/android-(?:test-)?v([0-9]+\\.[0-9]+\\.[0-9]+)-build([1-9][0-9]*)/ServeSync-([0-9]+\\.[0-9]+\\.[0-9]+)(?:-android-(?:test|release)-build([1-9][0-9]*))?\\.apk$"
    );
    private static final Pattern SHA256 = Pattern.compile("^[0-9a-fA-F]{64}$");
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        Integer build = call.getInt("build");
        Integer size = call.getInt("size");
        String hash = call.getString("sha256");
        String url = call.getString("url");
        if (!validRelease(url, build) || size == null || size < 1 || size > MAX_BYTES || !validHash(hash)) {
            call.reject("Unrecognized Android update package.");
            return;
        }
        if (!downloading.compareAndSet(false, true)) {
            call.reject("An update is already downloading.");
            return;
        }
        io.execute(() -> {
            File partial = null;
            try {
                File ready = updateFile(build);
                if (verifiedFile(ready, build, hash)) {
                    call.resolve();
                    return;
                }
                if (ready.exists()) ready.delete();
                partial = new File(ready.getParentFile(), ready.getName() + ".part");
                if (partial.exists()) partial.delete();
                download(url, partial, build, size, hash);
                if (!partial.renameTo(ready)) throw new IOException("Unable to prepare the downloaded update.");
                try { verifyPackage(ready, build); }
                catch (Exception error) { ready.delete(); throw error; }
                cleanOlderUpdates(ready);
                call.resolve();
            } catch (Exception error) {
                if (partial != null) partial.delete();
                call.reject("Unable to download or verify the update. Check your connection and try again.", error);
            } finally {
                downloading.set(false);
            }
        });
    }

    @PluginMethod
    public void getDownloadedUpdate(PluginCall call) {
        Integer build = call.getInt("build");
        String hash = call.getString("sha256");
        if (build == null || build < 1 || !validHash(hash)) {
            call.reject("Invalid update information.");
            return;
        }
        io.execute(() -> {
            try {
                File file = updateFile(build);
                boolean ready = verifiedFile(file, build, hash);
                if (!ready && file.exists()) file.delete();
                JSObject result = new JSObject();
                result.put("ready", ready);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Unable to check the downloaded update.", error);
            }
        });
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        Integer build = call.getInt("build");
        String hash = call.getString("sha256");
        if (build == null || build < 1 || !validHash(hash)) {
            call.reject("Invalid update information.");
            return;
        }
        io.execute(() -> {
            try {
                File file = updateFile(build);
                if (!verifiedFile(file, build, hash)) throw new IOException("Downloaded update is missing or invalid.");
                getActivity().runOnUiThread(() -> {
                    try {
                        JSObject result = new JSObject();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
                            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + getContext().getPackageName()));
                            getActivity().startActivity(settings);
                            result.put("action", "settings");
                        } else {
                            Uri uri = FileProvider.getUriForFile(getContext(),
                                getContext().getPackageName() + ".fileprovider", file);
                            Intent installer = new Intent(Intent.ACTION_VIEW);
                            installer.setDataAndType(uri, "application/vnd.android.package-archive");
                            installer.setClipData(ClipData.newRawUri("ServeSync update", uri));
                            installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            getActivity().startActivity(installer);
                            result.put("action", "installer");
                        }
                        call.resolve(result);
                    } catch (Exception error) {
                        call.reject("Unable to open Android's update installer.", error);
                    }
                });
            } catch (Exception error) {
                call.reject("The downloaded update could not be verified. Download it again.", error);
            }
        });
    }

    private static boolean validRelease(String url, Integer build) {
        if (url == null || build == null || build < 1) return false;
        Matcher match = RELEASE_URL.matcher(url);
        if (!match.matches() || !match.group(1).equals(match.group(3))) return false;
        try {
            return Integer.parseInt(match.group(2)) == build
                && (match.group(4) == null || Integer.parseInt(match.group(4)) == build);
        } catch (NumberFormatException error) { return false; }
    }

    private static boolean validHash(String hash) {
        return hash != null && SHA256.matcher(hash).matches();
    }

    private File updateFile(int build) throws IOException {
        File folder = new File(getContext().getFilesDir(), "updates");
        if (!folder.exists() && !folder.mkdirs()) throw new IOException("Update storage unavailable.");
        return new File(folder, "ServeSync-build" + build + ".apk");
    }

    private void download(String address, File file, int build, long expectedSize, String expectedHash) throws Exception {
        for (int redirect = 0; redirect < 6; redirect++) {
            URL target = new URL(address);
            if (!"https".equalsIgnoreCase(target.getProtocol())) throw new IOException("Insecure update URL.");
            HttpURLConnection connection = (HttpURLConnection) target.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("User-Agent", "ServeSync-Android-Updater");
            try {
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) throw new IOException("Missing update redirect.");
                    address = new URL(target, location).toString();
                    continue;
                }
                if (status != 200) throw new IOException("Update HTTP " + status);
                long length = connection.getContentLengthLong();
                if (length > MAX_BYTES || (length >= 0 && length != expectedSize)) throw new IOException("Update size changed.");
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long total = 0;
                long lastProgress = 0;
                try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(file)) {
                    byte[] buffer = new byte[32 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        total += count;
                        if (total > MAX_BYTES || total > expectedSize) throw new IOException("Update is too large.");
                        digest.update(buffer, 0, count);
                        output.write(buffer, 0, count);
                        long now = System.currentTimeMillis();
                        if (now - lastProgress >= 200) {
                            sendProgress(build, total, expectedSize);
                            lastProgress = now;
                        }
                    }
                }
                if (total != expectedSize || !hex(digest.digest()).equalsIgnoreCase(expectedHash)) {
                    throw new IOException("Update checksum did not match.");
                }
                sendProgress(build, total, expectedSize);
                return;
            } finally {
                connection.disconnect();
            }
        }
        throw new IOException("Too many update redirects.");
    }

    private void sendProgress(int build, long downloaded, long total) {
        JSObject event = new JSObject();
        event.put("build", build);
        event.put("downloaded", downloaded);
        event.put("total", total);
        event.put("percent", (int) Math.min(100, downloaded * 100 / total));
        getActivity().runOnUiThread(() -> notifyListeners("downloadProgress", event));
    }

    private boolean verifiedFile(File file, int build, String expectedHash) {
        if (!file.isFile() || file.length() < 1 || file.length() > MAX_BYTES) return false;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new FileInputStream(file)) {
                byte[] buffer = new byte[32 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
            }
            if (!hex(digest.digest()).equalsIgnoreCase(expectedHash)) return false;
            verifyPackage(file, build);
            return true;
        } catch (Exception error) { return false; }
    }

    @SuppressWarnings("deprecation")
    private void verifyPackage(File file, int build) throws Exception {
        PackageManager manager = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = manager.getPackageInfo(getContext().getPackageName(), flags);
        if (archive == null || !getContext().getPackageName().equals(archive.packageName)) {
            throw new IOException("Update is not a ServeSync APK.");
        }
        long archiveCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? archive.getLongVersionCode() : archive.versionCode;
        long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? installed.getLongVersionCode() : installed.versionCode;
        if (archiveCode != build || archiveCode <= installedCode) throw new IOException("Update build number is invalid.");
        Signature[] archiveSigners = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? archive.signingInfo == null ? null : archive.signingInfo.getApkContentsSigners() : archive.signatures;
        Signature[] installedSigners = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? installed.signingInfo == null ? null : installed.signingInfo.getApkContentsSigners() : installed.signatures;
        if (archiveSigners == null || archiveSigners.length == 0 || !Arrays.equals(archiveSigners, installedSigners)) {
            throw new IOException("Update signing certificate does not match the installed app.");
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            result.append(Character.forDigit((value >> 4) & 0xf, 16));
            result.append(Character.forDigit(value & 0xf, 16));
        }
        return result.toString();
    }

    private void cleanOlderUpdates(File keep) {
        File[] files = keep.getParentFile().listFiles();
        if (files == null) return;
        for (File file : files) {
            if (!file.equals(keep) && file.isFile() && (file.getName().endsWith(".apk") || file.getName().endsWith(".part"))) file.delete();
        }
    }
}
