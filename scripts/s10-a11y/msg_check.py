#!/usr/bin/env python3
# Check WhatsApp + Viber presence for phone numbers WITHOUT sending anything.
# Input: lines "id|name|qual|city|36XXXXXXXXX"; optional prior CSV with known WhatsApp results.
import subprocess, sys, re, time, random, csv, os
SER = os.environ.get('ADB_SERIAL', 'RF8M2101WXX')
ADB = [os.path.expanduser('~/Android/platform-tools/adb'), '-s', SER]
LOGDIR = os.path.expanduser('~/Android/s10')
def sh(*a): return subprocess.run(ADB + list(a), capture_output=True, text=True).stdout
def dump():
    sh('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
    return sh('shell', 'cat', '/sdcard/ui.xml')
def text_of(x, rid):
    m = re.search(r'text="([^"]*)" resource-id="' + re.escape(rid) + '"', x)
    return m.group(1) if m else ''
def a11y_click(key):
    sh('shell', 'am', 'broadcast', '-a', 'com.citoviso.a11y.CMD', '--es', 'op', 'click', '--es', 'key', f"'{key}'")
def home(): sh('shell', 'input', 'keyevent', 'KEYCODE_HOME')

def check_wa(ph):
    sh('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', f'https://wa.me/{ph}', '-p', 'com.whatsapp')
    res, seen = 'unknown', ''
    for _ in range(8):
        time.sleep(1.5)
        x = dump()
        if 'com.whatsapp:id/conversation_contact_name' in x:
            res = 'yes'; time.sleep(2.5)
            seen = text_of(dump(), 'com.whatsapp:id/conversation_contact_status'); break
        if re.search(r'nincsen regisztrálva a WhatsApp|nem használja a WhatsAppot|not on WhatsApp', x):
            res = 'no'; a11y_click('android:id/button1'); break
    if res == 'unknown': open(f'{LOGDIR}/unknown-wa-{ph}.xml', 'w').write(dump())
    home(); return res, seen

def check_viber(ph):
    sh('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', f"'viber://chat?number=%2B{ph}'")
    res, name, seen = 'unknown', '', ''
    for _ in range(8):
        time.sleep(1.5)
        x = dump()
        if 'A kérés nem elérhető' in x or 'nem elérhető' in text_of(x, 'com.viber.voip:id/alertTitle'):
            res = 'no'; a11y_click('android:id/button2'); break
        if ('com.viber.voip:id/menu_viber_call' in x or 'com.viber.voip:id/menu_mixed_call' in x):
            res = 'yes'; time.sleep(2)
            y = dump(); name = text_of(y, 'com.viber.voip:id/title'); seen = text_of(y, 'com.viber.voip:id/subtitle'); break
    if res == 'unknown': open(f'{LOGDIR}/unknown-vb-{ph}.xml', 'w').write(dump())
    home(); return res, name, seen

rows = [l.rstrip('\n').split('|') for l in open(sys.argv[1]) if l.strip()]
out = sys.argv[2]
known = {}
if len(sys.argv) > 3:
    for r in csv.DictReader(open(sys.argv[3])):
        if r['whatsapp'] in ('yes', 'no'): known[r['phone']] = (r['whatsapp'], r['last_seen'])
with open(out, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['lead_id', 'name', 'qualification', 'city', 'phone', 'whatsapp', 'wa_last_seen', 'viber', 'viber_name', 'viber_last_seen', 'checked_at'])
    for i, r in enumerate(rows):
        wa = known.get(r[4]) or check_wa(r[4])
        time.sleep(random.uniform(4, 8))
        vb = check_viber(r[4])
        w.writerow(r[:5] + list(wa) + list(vb) + [time.strftime('%Y-%m-%d %H:%M:%S')]); f.flush()
        print(f'{i+1}/{len(rows)} …{r[4][-4:]} WA={wa[0]} VB={vb[0]} {vb[2]}', flush=True)
        if i < len(rows) - 1: time.sleep(random.uniform(20, 35))
