package com.babcreations.servesync;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeFiles")
public class NativeFilesPlugin extends Plugin {
    private static final long MAX_BYTES = 100L * 1024L * 1024L;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Map<String, File> pendingSaves = new ConcurrentHashMap<>();
    private boolean foreground = true;

    @PluginMethod
    public void saveRemote(PluginCall call) { prepareRemote(call, "save"); }

    @PluginMethod
    public void openRemote(PluginCall call) { prepareRemote(call, "open"); }

    @PluginMethod
    public void shareRemote(PluginCall call) { prepareRemote(call, "share"); }

    @PluginMethod
    public void saveBase64(PluginCall call) {
        String encoded = call.getString("base64");
        String name = safeName(call.getString("name"));
        if (encoded == null || encoded.length() > MAX_BYTES * 4 / 3 + 4) {
            call.reject("The file is too large to save.");
            return;
        }
        io.execute(() -> {
            File file = null;
            try {
                file = newCacheFile(name);
                byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                if (bytes.length > MAX_BYTES) throw new IOException("The file is too large to save.");
                try (OutputStream output = new FileOutputStream(file)) { output.write(bytes); }
                File ready = file;
                getActivity().runOnUiThread(() -> {
                    if (!isReadyForIntent(call, ready)) return;
                    showSavePicker(call, ready, name, mimeType(name, call.getString("mimeType")));
                });
            } catch (Exception error) {
                if (file != null) file.delete();
                call.reject("Unable to prepare the file for saving.", error);
            }
        });
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.isEmpty()) {
            call.reject("Nothing to share.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, text);
        String title = call.getString("title");
        if (title != null) intent.putExtra(Intent.EXTRA_SUBJECT, title);
        try {
            getActivity().startActivity(Intent.createChooser(intent, title == null ? "Share" : title));
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to open Android sharing.", error);
        }
    }

    private void prepareRemote(PluginCall call, String action) {
        String url = call.getString("url");
        String name = safeName(call.getString("name"));
        if (url == null || !isHttps(url)) {
            call.reject("This file needs a secure HTTPS link.");
            return;
        }
        io.execute(() -> {
            File file = null;
            try {
                file = newCacheFile(name);
                download(url, file);
                File ready = file;
                String mime = mimeType(name, call.getString("mimeType"));
                getActivity().runOnUiThread(() -> {
                    if (!isReadyForIntent(call, ready)) return;
                    if ("save".equals(action)) showSavePicker(call, ready, name, mime);
                    else showExternalIntent(call, ready, mime, "share".equals(action));
                });
            } catch (Exception error) {
                if (file != null) file.delete();
                call.reject("Unable to download the file. Check your connection and try again.", error);
            }
        });
    }

    private void download(String address, File file) throws IOException {
        for (int redirect = 0; redirect < 4; redirect++) {
            if (!isHttps(address)) throw new IOException("Insecure file URL");
            HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            try {
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) throw new IOException("Missing redirect location");
                    address = new URL(new URL(address), location).toString();
                    continue;
                }
                if (status < 200 || status >= 300) throw new IOException("HTTP " + status);
                if (connection.getContentLengthLong() > MAX_BYTES) throw new IOException("File too large");
                try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(file)) {
                    byte[] buffer = new byte[16 * 1024];
                    long total = 0;
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        total += count;
                        if (total > MAX_BYTES) throw new IOException("File too large");
                        output.write(buffer, 0, count);
                    }
                }
                return;
            } finally {
                connection.disconnect();
            }
        }
        throw new IOException("Too many redirects");
    }

    private void showSavePicker(PluginCall call, File file, String name, String mime) {
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.setType(mime);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.putExtra(Intent.EXTRA_TITLE, name);
            pendingSaves.put(call.getCallbackId(), file);
            startActivityForResult(call, intent, "saveResult");
        } catch (Exception error) {
            pendingSaves.remove(call.getCallbackId());
            file.delete();
            call.reject("Unable to open Android's Save dialog.", error);
        }
    }

    private boolean isReadyForIntent(PluginCall call, File file) {
        if (foreground && !getActivity().isFinishing()) return true;
        file.delete();
        call.reject("Return to ServeSync and try again.", "BACKGROUND");
        return false;
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        File source = pendingSaves.remove(call.getCallbackId());
        Uri destination = result.getData() == null ? null : result.getData().getData();
        if (source == null) {
            call.reject("The prepared file is no longer available.");
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK || destination == null) {
            source.delete();
            call.reject("Save canceled.", "CANCELED");
            return;
        }
        io.execute(() -> {
            try (InputStream input = new java.io.FileInputStream(source);
                 OutputStream output = getContext().getContentResolver().openOutputStream(destination, "w")) {
                if (output == null) throw new IOException("Save destination unavailable");
                byte[] buffer = new byte[16 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                JSObject value = new JSObject();
                value.put("saved", true);
                call.resolve(value);
            } catch (Exception error) {
                call.reject("Unable to write the selected file.", error);
            } finally {
                source.delete();
            }
        });
    }

    private void showExternalIntent(PluginCall call, File file, String mime, boolean share) {
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(share ? Intent.ACTION_SEND : Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri("file", uri));
            if (share) intent.setType(mime);
            if (share) intent.putExtra(Intent.EXTRA_STREAM, uri);
            else intent.setDataAndType(uri, mime);
            getActivity().startActivity(share ? Intent.createChooser(intent, "Share file") : intent);
            call.resolve();
        } catch (Exception error) {
            file.delete();
            call.reject(share ? "Unable to share the file." : "No app can open this file.", error);
        }
    }

    private File newCacheFile(String name) throws IOException {
        File root = new File(getContext().getCacheDir(), "shared-files");
        File[] previous = root.listFiles();
        if (previous != null) {
            long cutoff = System.currentTimeMillis() - 7L * 24L * 60L * 60L * 1000L;
            for (File old : previous) {
                if (old.isDirectory() && old.lastModified() < cutoff) {
                    File[] children = old.listFiles();
                    if (children != null) for (File child : children) child.delete();
                    old.delete();
                }
            }
        }
        File folder = new File(root, UUID.randomUUID().toString());
        if (!folder.mkdirs()) throw new IOException("Unable to create file cache");
        return new File(folder, name);
    }

    private static boolean isHttps(String address) {
        try { return "https".equalsIgnoreCase(new URL(address).getProtocol()); }
        catch (Exception error) { return false; }
    }

    private static String safeName(String value) {
        String name = value == null ? "file" : value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (name.isEmpty()) name = "file";
        return name.length() > 160 ? name.substring(0, 160) : name;
    }

    private static String mimeType(String name, String provided) {
        if (provided != null && provided.matches("^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+$")) return provided;
        int dot = name.lastIndexOf('.');
        String extension = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
        String inferred = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        return inferred == null ? "application/octet-stream" : inferred;
    }

    @Override
    protected void handleOnPause() {
        foreground = false;
    }

    @Override
    protected void handleOnResume() {
        foreground = true;
    }

    @Override
    protected void handleOnDestroy() {
        foreground = false;
        io.shutdown();
        for (File file : pendingSaves.values()) file.delete();
        pendingSaves.clear();
    }
}
