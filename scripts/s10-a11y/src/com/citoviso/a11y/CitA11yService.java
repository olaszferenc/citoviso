package com.citoviso.a11y;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

// Accessibility bridge driven by adb broadcasts, for apps that drop injected input.
// am broadcast -a com.citoviso.a11y.CMD --es op click|settext|focus|longclick|back|home --es key <id|text|desc|~substr> [--es text <t>] [--ei idx N]
// Results are logged under tag CITA11Y.
public class CitA11yService extends AccessibilityService {
    static final String TAG = "CITA11Y";
    private final CmdReceiver rx = new CmdReceiver(this);

    String run(Intent i) {
        String r;
        try { r = handle(i); } catch (Exception e) { r = "ERR " + e; }
        Log.i(TAG, r);
        return r;
    }

    @Override protected void onServiceConnected() {
        registerReceiver(rx, new IntentFilter("com.citoviso.a11y.CMD"));
        Log.i(TAG, "READY");
    }
    @Override public void onAccessibilityEvent(AccessibilityEvent e) {}
    @Override public void onInterrupt() {}

    private String handle(Intent i) {
        String op = i.getStringExtra("op");
        String key = i.getStringExtra("key");
        int idx = i.getIntExtra("idx", 0);
        if ("back".equals(op)) return "OK " + performGlobalAction(GLOBAL_ACTION_BACK);
        if ("home".equals(op)) return "OK " + performGlobalAction(GLOBAL_ACTION_HOME);
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return "ERR no root";
        AccessibilityNodeInfo n = find(root, key, new int[]{idx});
        if (n == null) return "NOTFOUND " + key;
        boolean ok;
        switch (op) {
            case "settext": {
                Bundle b = new Bundle();
                b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, i.getStringExtra("text"));
                ok = n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b);
                break;
            }
            case "focus": ok = n.performAction(AccessibilityNodeInfo.ACTION_FOCUS); break;
            case "longclick": ok = clickable(n).performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK); break;
            default: ok = clickable(n).performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }
        return "OK " + op + " " + key + " -> " + ok;
    }

    private static AccessibilityNodeInfo clickable(AccessibilityNodeInfo n) {
        AccessibilityNodeInfo p = n;
        while (p != null && !p.isClickable()) p = p.getParent();
        return p != null ? p : n;
    }

    private static boolean match(AccessibilityNodeInfo n, String key) {
        String id = n.getViewIdResourceName();
        String t = n.getText() == null ? "" : n.getText().toString();
        String d = n.getContentDescription() == null ? "" : n.getContentDescription().toString();
        if (key.startsWith("~")) {
            String k = key.substring(1).toLowerCase();
            return t.toLowerCase().contains(k) || d.toLowerCase().contains(k);
        }
        return key.equals(id) || key.equals(t) || key.equals(d);
    }

    private static AccessibilityNodeInfo find(AccessibilityNodeInfo n, String key, int[] idx) {
        if (n == null) return null;
        if (match(n, key)) { if (idx[0] == 0) return n; idx[0]--; }
        for (int c = 0; c < n.getChildCount(); c++) {
            AccessibilityNodeInfo r = find(n.getChild(c), key, idx);
            if (r != null) return r;
        }
        return null;
    }
}
