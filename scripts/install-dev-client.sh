#!/bin/bash
# Installs the debug dev client over a flaky USB link: waits for the phone, retries
# `adb install -r` until it sticks, then opens the dev client on Metro (adb reverse).
# Usage: scripts/install-dev-client.sh [apk]   (default: the arm64 debug build)
cd "$(dirname "$0")/.."
ADB=${ADB:-/mnt/c/Users/HP/AppData/Local/Android/Sdk/platform-tools/adb.exe}
APK=${1:-android/app/build/outputs/apk/debug/app-debug.apk}
WIN_APK='C:\Users\HP\owiwi-debug.apk' # adb.exe reads Windows paths; copying also leaves a sideloadable APK
TRIES=${TRIES:-15}

[ -f "$APK" ] || { echo "no APK at $APK; build it first"; exit 1; }
cp "$APK" /mnt/c/Users/HP/owiwi-debug.apk

for i in $(seq 1 "$TRIES"); do
  until "$ADB" get-state >/dev/null 2>&1; do sleep 2; done
  echo "attempt $i: installing"
  if out=$("$ADB" install -r "$WIN_APK" 2>&1) && grep -q Success <<<"$out"; then
    "$ADB" reverse tcp:8081 tcp:8081 >/dev/null 2>&1
    "$ADB" shell am start -a android.intent.action.VIEW \
      -d "'exp+owiwi://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'" >/dev/null 2>&1
    echo "installed and launched"
    exit 0
  fi
  echo "attempt $i failed: $(tail -n 1 <<<"$out" | tr -d '\r')"
  sleep 3
done
echo "gave up after $TRIES attempts; sideload $WIN_APK instead"
exit 1
