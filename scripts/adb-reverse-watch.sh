#!/bin/bash
# Keeps `adb reverse tcp:8081` alive across flaky USB reconnects (WSL dev setup).
ADB=${ADB:-/mnt/c/Users/HP/AppData/Local/Android/Sdk/platform-tools/adb.exe}
while true; do
  if "$ADB" get-state >/dev/null 2>&1; then
    "$ADB" reverse --list 2>/dev/null | grep -q "tcp:8081" || "$ADB" reverse tcp:8081 tcp:8081 >/dev/null 2>&1
  fi
  sleep 3
done
