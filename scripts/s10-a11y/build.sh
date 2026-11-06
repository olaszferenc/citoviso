#!/bin/bash
# Build + install + enable the Citoviso accessibility bridge on the S10.
# Needs: openjdk-21-jdk-headless, ~/Android build-tools;34.0.0 + platforms;android-34.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="$HOME/Android"; B="$SDK/build-tools/34.0.0"; P="$SDK/platforms/android-34/android.jar"
ADB="$SDK/platform-tools/adb -s ${ADB_SERIAL:-RF8M2101WXX}"
OUT="$HOME/Android/s10/a11y-build"; KS="$HOME/Android/s10/a11y/key.jks"
mkdir -p "$OUT/cls" "$OUT/dex"
"$B/aapt2" compile --dir "$HERE/res" -o "$OUT/res.zip"
"$B/aapt2" link -o "$OUT/base.apk" -I "$P" --manifest "$HERE/AndroidManifest.xml" "$OUT/res.zip"
javac --release 11 -classpath "$P" -d "$OUT/cls" "$HERE"/src/com/citoviso/a11y/*.java
(cd "$OUT/cls" && jar cf "$OUT/cls.jar" .)
"$B/d8" --release --min-api 26 --lib "$P" --output "$OUT/dex" "$OUT/cls.jar"
python3 -c "import shutil,zipfile,sys; shutil.copy(sys.argv[1],sys.argv[2]); z=zipfile.ZipFile(sys.argv[2],'a'); z.write(sys.argv[3],'classes.dex'); z.close()" "$OUT/base.apk" "$OUT/u.apk" "$OUT/dex/classes.dex"
"$B/zipalign" -f 4 "$OUT/u.apk" "$OUT/a.apk"
[ -f "$KS" ] || { mkdir -p "$(dirname "$KS")"; keytool -genkeypair -keystore "$KS" -storepass citoviso -keypass citoviso -alias k -keyalg RSA -validity 10000 -dname CN=citoviso; }
"$B/apksigner" sign --ks "$KS" --ks-pass pass:citoviso --out "$OUT/citoviso-a11y.apk" "$OUT/a.apk"
# Play Protect's adb-install dialog otherwise stalls `adb install` ("Serving...").
$ADB shell settings put global verifier_verify_adb_installs 0
$ADB push "$OUT/citoviso-a11y.apk" /data/local/tmp/cita11y.apk
$ADB shell pm install -r /data/local/tmp/cita11y.apk
$ADB shell settings put secure enabled_accessibility_services com.citoviso.a11y/.CitA11yService
$ADB shell settings put secure accessibility_enabled 1
