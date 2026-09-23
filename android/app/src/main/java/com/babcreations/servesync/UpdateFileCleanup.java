package com.babcreations.servesync;

import java.io.File;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Cleans only APKs created by ServeSync's in-app updater. */
final class UpdateFileCleanup {
    private static final Pattern MANAGED_FILE = Pattern.compile("^ServeSync-build([1-9][0-9]*)\\.apk(\\.part)?$");

    private UpdateFileCleanup() {}

    static void afterInstall(File folder, long installedBuild) {
        File[] files = folder.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (!file.isFile()) continue;
            Matcher match = MANAGED_FILE.matcher(file.getName());
            if (!match.matches()) continue;
            try {
                long build = Long.parseLong(match.group(1));
                // A cancelled installer leaves a newer, verified APK available to retry.
                if (match.group(2) != null || build <= installedBuild) file.delete();
            } catch (NumberFormatException ignored) {
                // An invalid filename is not one of the updater's managed packages.
            }
        }
    }

    static void afterDownload(File folder, File keep) {
        File[] files = folder.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (!file.equals(keep) && file.isFile() && MANAGED_FILE.matcher(file.getName()).matches()) {
                file.delete();
            }
        }
    }
}
