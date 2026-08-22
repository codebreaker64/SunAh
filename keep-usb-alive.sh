#!/usr/bin/env bash
# adb reverse silently drops whenever the USB link glitches, and the only
# symptom is the app saying "Hokkien voice unavailable" — which looks like an
# app bug and is not one. This re-establishes it every 10 seconds.
#
#   bash keep-usb-alive.sh
#
# Leave it running in its own terminal while testing or recording.
export PATH="/c/Users/foong/android/platform-tools:$PATH"
export MSYS_NO_PATHCONV=1
while true; do
  have=$(adb reverse --list 2>/dev/null | grep -c "tcp:8000")
  if [ "$have" = "0" ]; then
    adb reverse tcp:8000 tcp:8000 >/dev/null 2>&1
    adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1
    echo "$(date +%H:%M:%S) re-established adb reverse"
  fi
  sleep 10
done
