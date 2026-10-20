#!/bin/bash
# Installs an APK over a flaky USB link: waits for the phone, retries `adb install -r`
# until it sticks, then opens the app (the dev client on Metro via adb reverse, or a
# release build as is). Usage: scripts/install-dev-client.sh [apk]
#   default: the arm64 debug dev client; pass app-release.apk for a release build.
cd "$(dirname "$0")/.."
ADB_BIN=${ADB:-/mnt/c/Users/HP/AppData/Local/Android/Sdk/platform-tools/adb.exe}
# SERIAL picks a device when several are attached (e.g. USB plus Wi-Fi adb at 192.168.1.49:5555).
adb() { "$ADB_BIN" ${SERIAL:+-s "$SERIAL"} "$@"; }
APK=${1:-android/app/build/outputs/apk/debug/app-debug.apk}
case "$APK" in *release*) NAME=owiwi-release.apk ;; *) NAME=owiwi-debug.apk ;; esac
WIN_APK="C:\\Users\\HP\\$NAME" # adb.exe reads Windows paths; copying also leaves a sideloadable APK
TRIES=${TRIES:-15}

[ -f "$APK" ] || { echo "no APK at $APK; build it first"; exit 1; }
cp "$APK" "/mnt/c/Users/HP/$NAME"

for i in $(seq 1 "$TRIES"); do
  until adb get-state >/dev/null 2>&1; do sleep 2; done
  echo "attempt $i: installing"
  if out=$(adb install -r "$WIN_APK" 2>&1) && grep -q Success <<<"$out"; then
    if [ "$NAME" = owiwi-release.apk ]; then
      adb shell monkey -p app.owiwi -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    else
      adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1
      adb shell am start -a android.intent.action.VIEW \
        -d "'exp+owiwi://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'" >/dev/null 2>&1
    fi
    echo "installed and launched"
    exit 0
  fi
  echo "attempt $i failed: $(tail -n 1 <<<"$out" | tr -d '\r')"
  sleep 3
done
echo "gave up after $TRIES attempts; sideload $WIN_APK instead"
exit 1
