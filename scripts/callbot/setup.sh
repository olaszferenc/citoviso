#!/bin/bash
# One-shot host setup for the call bot (Debian 13, user citoviso).
# Idempotent: safe to re-run after a reinstall or on a replacement box.
#
# Hardware this expects:
#   - Samsung Galaxy S10 (SM-G973F) on USB with USB debugging authorised, modem SIM inside
#   - ASUS USB-BT400 Bluetooth adapter (Broadcom BCM20702A1, USB id 0b05:17cb)
#
# What it does:
#   1. apt packages: BlueZ, BlueALSA, ALSA utils, sox, ffmpeg, python venv
#   2. udev rule so adb can open the Samsung phone without root
#   3. Broadcom firmware patch for the BT400 (not shipped by Debian)
#   4. BlueALSA runs as a Bluetooth hands-free unit (hfp-hf) instead of A2DP
#   5. user groups (plugdev, audio, bluetooth)
#   6. python venv with faster-whisper (transcription) + piper-tts (speech) and the Hungarian voice
# Pairing the phone (one-off) is printed at the end; it needs the phone unlocked.
set -euo pipefail

USER_NAME="${SUDO_USER:-$(id -un)}"
HOME_DIR="$(getent passwd "$USER_NAME" | cut -d: -f6)"
VENV="$HOME_DIR/speech-venv"
VOICES="$HOME_DIR/speech/voices"
FW=/lib/firmware/brcm/BCM20702A1-0b05-17cb.hcd

echo "== 1. packages"
# The Plex source on this box has no Release file; skip third-party lists so apt does not abort.
sudo apt-get update -qq -o Dir::Etc::sourceparts=/dev/null
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q -o Dir::Etc::sourceparts=/dev/null \
  bluez bluez-alsa-utils libasound2-plugin-bluez alsa-utils sox ffmpeg python3-venv python3-pip curl

echo "== 2. udev rule for the Samsung phone"
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="04e8", MODE="0666", GROUP="plugdev"' |
  sudo tee /etc/udev/rules.d/51-android-samsung.rules >/dev/null
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=usb --attr-match=idVendor=04e8 || true

echo "== 3. Broadcom firmware for the BT400"
if [ ! -s "$FW" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/fw.hcd" \
    https://raw.githubusercontent.com/winterheart/broadcom-bt-firmware/master/brcm/BCM20702A1-0b05-17cb.hcd
  sudo install -D -m644 "$tmp/fw.hcd" "$FW"
  rm -rf "$tmp"
  sudo modprobe -r btusb && sudo modprobe btusb
fi

echo "== 4. BlueALSA as hands-free unit"
sudo mkdir -p /etc/systemd/system/bluealsa.service.d
printf '[Service]\nExecStart=\nExecStart=/usr/bin/bluealsa -S -p hfp-hf\n' |
  sudo tee /etc/systemd/system/bluealsa.service.d/override.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now bluetooth
sudo systemctl restart bluealsa

echo "== 5. groups"
sudo usermod -aG plugdev,audio,bluetooth "$USER_NAME"

echo "== 6. speech venv + Hungarian voice"
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install -q faster-whisper piper-tts numpy
mkdir -p "$VOICES"
for f in hu_HU-anna-medium.onnx hu_HU-anna-medium.onnx.json; do
  [ -s "$VOICES/$f" ] || curl -fsSL -o "$VOICES/$f" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/hu/hu_HU/anna/medium/$f"
done
chown -R "$USER_NAME" "$VENV" "$HOME_DIR/speech"

cat <<'EOF'

== Done. One-off steps on the phone (needs it unlocked):
  adb shell settings put global stay_on_while_plugged_in 7     # screen stays on while charging
  adb shell am start -a android.settings.BLUETOOTH_SETTINGS     # makes the phone discoverable
  bluetoothctl  ->  agent DisplayYesNo / default-agent / scan on / pair <phone MAC> / yes / trust <MAC> / connect <MAC>
  then tap "Párosítás" on the phone dialog.
Check: sudo bluealsa-cli list-pcms   -> .../hfphf/sink and .../hfphf/source
Run:   sg audio -c "python3 scripts/callbot/callbot.py answer --text '...'"
EOF
