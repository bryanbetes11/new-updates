package com.babcreations.servesync;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotificationSettingsPlugin.class);
        registerPlugin(InteractionHapticsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
