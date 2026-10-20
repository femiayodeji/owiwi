#!/bin/bash
# Event-driven dev loop for a USB Android phone from WSL. One line per event on stdout:
#   PHONE+ / PHONE- / PHONE? (unauthorized)  device plugged, unplugged, waiting for the USB prompt
#   REVERSE  adb reverse tcp:8081 (re)applied     LAUNCH  dev client opened on Metro
#   METRO    Metro started / restarted / bundled  JS / CRASH  errors from logcat and Metro
# Keeps Metro running (log: .expo-metro.log), re-applies adb reverse after every reconnect and
# reopens the dev client on reconnect. Stop with Ctrl+C (or kill the process group).
cd "$(dirname "$0")/.."
ADB=${ADB:-/mnt/c/Users/HP/AppData/Local/Android/Sdk/platform-tools/adb.exe}
PORT=8081
PKG=app.owiwi
DEV_URL="exp+owiwi://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${PORT}"
METRO_LOG=.expo-metro.log

say() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*"; }

metro_up() { curl -s -m 5 "localhost:${PORT}/status" 2>/dev/null | grep -q running; }
# Something (a busy Metro included) is still listening on the port: never start a second one.
port_bound() { ss -ltn 2>/dev/null | grep -q ":${PORT} "; }

start_metro() {
  if port_bound; then say "METRO port :${PORT} still bound, not starting another"; return; fi
  echo "--- $(date) restart" >> "$METRO_LOG"
  setsid nohup npx expo start --dev-client --port "$PORT" >> "$METRO_LOG" 2>&1 < /dev/null &
  for _ in $(seq 1 60); do metro_up && break; sleep 1; done
  if metro_up; then say "METRO up on :${PORT}"; else say "METRO failed to start, see ${METRO_LOG}"; fi
}

# Bundle events and errors from Metro, as they happen.
follow_metro() {
  tail -n 0 -F "$METRO_LOG" 2>/dev/null | grep --line-buffered -E "Bundled|Bundling failed|ERROR|Error:|SyntaxError|Unable to resolve" |
    while IFS= read -r line; do
      case "$line" in
        *Bundled*) say "METRO ${line}" ;;
        *) say "JS ${line}" ;;
      esac
    done
}

# JS errors and native crashes from the phone, as they happen.
follow_logcat() {
  local serial=$1
  "$ADB" -s "$serial" logcat -T 1 -v brief ReactNativeJS:E ReactNative:E AndroidRuntime:E '*:S' 2>/dev/null | tr -d '\r' |
    grep --line-buffered -vE "^-+ beginning of|^$" |
    while IFS= read -r line; do
      case "$line" in
        *AndroidRuntime*) say "CRASH ${line}" ;;
        *) say "JS ${line}" ;;
      esac
    done
}

declare -A STATE LOGCAT_PID
cleanup() { kill 0 2>/dev/null; }
trap cleanup EXIT INT TERM

metro_up && say "METRO already running on :${PORT}" || start_metro
follow_metro &

say "WATCH waiting for phones (adb: ${ADB})"
while true; do
  declare -A SEEN=()
  while read -r serial state _; do
    [ -z "$serial" ] && continue
    SEEN[$serial]=1
    prev=${STATE[$serial]:-}
    if [ "$state" != "$prev" ]; then
      STATE[$serial]=$state
      case "$state" in
        device)
          model=$("$ADB" -s "$serial" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
          say "PHONE+ ${serial} (${model})"
          "$ADB" -s "$serial" reverse tcp:${PORT} tcp:${PORT} >/dev/null 2>&1 && say "REVERSE tcp:${PORT} set on ${serial}"
          if "$ADB" -s "$serial" shell dumpsys activity activities 2>/dev/null | grep -m1 topResumedActivity | grep -q "$PKG/"; then
            # Already on screen: a USB blip must not reload the app mid-bundle or mid-test.
            say "PHONE ${serial} resumed; ${PKG} already in front, left as is"
          elif ! pkgs=$("$ADB" -s "$serial" shell pm list packages "$PKG" 2>/dev/null); then
            say "PHONE ${serial} couldn't be queried (USB dropped mid-command); will retry on reconnect"
          elif grep -q "package:${PKG}" <<<"$pkgs"; then
            "$ADB" -s "$serial" shell am start -a android.intent.action.VIEW -d "'${DEV_URL}'" >/dev/null 2>&1 &&
              say "LAUNCH dev client on ${serial}"
          else
            say "PHONE ${serial} has no ${PKG} dev build; run ./android-rebuild.sh"
          fi
          follow_logcat "$serial" &
          LOGCAT_PID[$serial]=$!
          ;;
        unauthorized) say "PHONE? ${serial} unauthorized: accept the USB debugging prompt on the phone" ;;
        *) say "PHONE ${serial} state ${state}" ;;
      esac
    elif [ "$state" = device ]; then
      # Reverse can drop without a visible disconnect (adb server restart, flaky cable).
      "$ADB" -s "$serial" reverse --list 2>/dev/null | grep -q "tcp:${PORT}" ||
        { "$ADB" -s "$serial" reverse tcp:${PORT} tcp:${PORT} >/dev/null 2>&1 && say "REVERSE tcp:${PORT} re-applied on ${serial}"; }
    fi
  done < <(timeout 10 "$ADB" devices 2>/dev/null | tr -d '\r' | tail -n +2)

  for serial in "${!STATE[@]}"; do
    if [ -z "${SEEN[$serial]:-}" ]; then
      say "PHONE- ${serial} disconnected"
      [ -n "${LOGCAT_PID[$serial]:-}" ] && pkill -P "${LOGCAT_PID[$serial]}" 2>/dev/null; kill "${LOGCAT_PID[$serial]:-}" 2>/dev/null
      unset "STATE[$serial]" "LOGCAT_PID[$serial]"
    fi
  done
  unset SEEN

  # A Metro busy bundling can miss one health check; restart only after ~15s of failures.
  if metro_up; then metro_fails=0; else metro_fails=$((metro_fails + 1)); fi
  if [ "${metro_fails:-0}" -ge 3 ]; then say "METRO down, restarting"; metro_fails=0; start_metro; fi
  sleep 2
done
