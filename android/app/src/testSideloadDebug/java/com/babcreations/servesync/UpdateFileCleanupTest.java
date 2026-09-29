package com.babcreations.servesync;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class UpdateFileCleanupTest {
    @Rule public TemporaryFolder temporaryFolder = new TemporaryFolder();

    @Test
    public void installedBuildIsRemovedButCancelledFutureInstallCanBeRetried() throws Exception {
        File folder = temporaryFolder.newFolder("updates");
        File previous = new File(folder, "ServeSync-build16.apk");
        File installed = new File(folder, "ServeSync-build17.apk");
        File pending = new File(folder, "ServeSync-build18.apk");
        File partial = new File(folder, "ServeSync-build19.apk.part");
        File unrelated = new File(folder, "other-app.apk");
        assertTrue(previous.createNewFile());
        assertTrue(installed.createNewFile());
        assertTrue(pending.createNewFile());
        assertTrue(partial.createNewFile());
        assertTrue(unrelated.createNewFile());

        UpdateFileCleanup.afterInstall(folder, 17);

        assertFalse(previous.exists());
        assertFalse(installed.exists());
        assertFalse(partial.exists());
        assertTrue(pending.exists());
        assertTrue(unrelated.exists());
    }

    @Test
    public void completedDownloadKeepsOnlyTheSelectedUpdaterPackage() throws Exception {
        File folder = temporaryFolder.newFolder("updates");
        File previous = new File(folder, "ServeSync-build17.apk");
        File keep = new File(folder, "ServeSync-build18.apk");
        File partial = new File(folder, "ServeSync-build18.apk.part");
        File unrelated = new File(folder, "notes.apk");
        assertTrue(previous.createNewFile());
        assertTrue(keep.createNewFile());
        assertTrue(partial.createNewFile());
        assertTrue(unrelated.createNewFile());

        UpdateFileCleanup.afterDownload(folder, keep);

        assertFalse(previous.exists());
        assertFalse(partial.exists());
        assertTrue(keep.exists());
        assertTrue(unrelated.exists());
    }
}
