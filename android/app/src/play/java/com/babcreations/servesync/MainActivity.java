package com.babcreations.servesync;

import com.getcapacitor.BridgeActivity;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.lifecycle.Lifecycle;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ServeSyncPlayUpdate";
    private AppUpdateManager updateManager;
    private AlertDialog updateDialog;
    private boolean checkingForUpdate;
    private boolean updateFlowStarted;
    private boolean useStoreFallback;
    private ActivityResultLauncher<androidx.activity.result.IntentSenderRequest> updateLauncher;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotificationSettingsPlugin.class);
        registerPlugin(InteractionHapticsPlugin.class);
        registerPlugin(NativeFilesPlugin.class);
        registerPlugin(ScreenAwakePlugin.class);
        registerPlugin(NativeImageCachePlugin.class);
        registerPlugin(SystemBarsPlugin.class);
        super.onCreate(savedInstanceState);
        updateManager = AppUpdateManagerFactory.create(this);
        updateLauncher = registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(), result -> {
                updateFlowStarted = false;
                if (result.getResultCode() != RESULT_OK) checkForPlayUpdate();
            });
    }

    @Override
    public void onResume() {
        super.onResume();
        checkForPlayUpdate();
    }

    private void checkForPlayUpdate() {
        if (updateManager == null || checkingForUpdate || updateFlowStarted || isFinishing()) return;
        checkingForUpdate = true;
        updateManager.getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                checkingForUpdate = false;
                if (!getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)) return;
                int availability = info.updateAvailability();
                if (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    startImmediateUpdate(info);
                } else if (availability == UpdateAvailability.UPDATE_AVAILABLE) {
                    showRequiredUpdateDialog(info);
                } else {
                    dismissUpdateDialog();
                }
            })
            .addOnFailureListener(error -> {
                checkingForUpdate = false;
                Log.w(TAG, "Google Play update check failed; will retry on next resume", error);
            });
    }

    private void showRequiredUpdateDialog(AppUpdateInfo info) {
        if (isFinishing() || (updateDialog != null && updateDialog.isShowing())) return;
        boolean immediateAllowed = !useStoreFallback && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE);
        updateDialog = new AlertDialog.Builder(this)
            .setTitle("Update ServeSync")
            .setMessage("A newer test version is available on Google Play. Update to continue using ServeSync.")
            .setCancelable(false)
            .setPositiveButton("Update", (dialog, which) -> {
                if (immediateAllowed) startImmediateUpdate(info);
                else openPlayStore();
            })
            .setNegativeButton("Exit", (dialog, which) -> finish())
            .create();
        updateDialog.setCanceledOnTouchOutside(false);
        updateDialog.show();
    }

    private void startImmediateUpdate(AppUpdateInfo info) {
        if (updateFlowStarted || isFinishing()) return;
        if (!info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
            showRequiredUpdateDialog(info);
            return;
        }
        try {
            updateFlowStarted = updateManager.startUpdateFlowForResult(
                info, updateLauncher, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build());
            if (!updateFlowStarted) {
                useStoreFallback = true;
                showRequiredUpdateDialog(info);
            }
        } catch (Exception error) {
            updateFlowStarted = false;
            useStoreFallback = true;
            Log.w(TAG, "Could not start Google Play update", error);
            showRequiredUpdateDialog(info);
        }
    }

    private void openPlayStore() {
        Intent intent = new Intent(Intent.ACTION_VIEW,
            Uri.parse("market://details?id=" + getPackageName()));
        try {
            startActivity(intent);
        } catch (android.content.ActivityNotFoundException error) {
            startActivity(new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://play.google.com/store/apps/details?id=" + getPackageName())));
        }
    }

    private void dismissUpdateDialog() {
        if (updateDialog != null) {
            updateDialog.dismiss();
            updateDialog = null;
        }
    }
}
