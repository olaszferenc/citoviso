package com.citoviso.a11y;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// Receives adb broadcasts and forwards them to the accessibility service.
public class CmdReceiver extends BroadcastReceiver {
    private final CitA11yService svc;
    public CmdReceiver(CitA11yService svc) { this.svc = svc; }
    @Override public void onReceive(Context c, Intent i) { setResultData(svc.run(i)); }
}
