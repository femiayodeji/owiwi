#!/bin/bash
# Dev loop for a USB Android phone from WSL: keeps adb reverse alive and runs Metro
# (fast refresh on). Logs: .expo-metro.log. Stop with: pkill -f adb-reverse-watch; pkill -f "expo start"
cd "$(dirname "$0")/.."
pgrep -f "^bash scripts/adb-reverse-watch.sh" > /dev/null || setsid nohup bash scripts/adb-reverse-watch.sh > /dev/null 2>&1 < /dev/null &
setsid nohup npx expo start --dev-client --port 8081 > .expo-metro.log 2>&1 < /dev/null &
