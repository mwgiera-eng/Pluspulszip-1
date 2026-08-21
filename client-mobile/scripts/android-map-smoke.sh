#!/usr/bin/env bash
set -euo pipefail

package_name="pl.pluspuls.app"
apk_path="android/app/build/outputs/apk/release/app-release.apk"
artifact_dir="artifacts/map-smoke"
ui_dump="$artifact_dir/window.xml"
filtered_log="$artifact_dir/logcat-errors.txt"

capture_failure() {
  adb exec-out screencap -p > "$artifact_dir/map-smoke-failed.png" 2>/dev/null || true
}

tap_label() {
  local label="$1"
  local expected="$2"
  local tap_x tap_y
  read -r tap_x tap_y < <(python3 scripts/map-smoke-tools.py tap "$ui_dump" "$label")
  adb shell input tap "$tap_x" "$tap_y"
  sleep 2
  adb shell uiautomator dump /sdcard/pluspuls-map.xml >/dev/null 2>&1
  adb exec-out cat /sdcard/pluspuls-map.xml > "$ui_dump"
  python3 scripts/map-smoke-tools.py checked "$ui_dump" "$label" "$expected"
}

assert_zoom_stage() {
  local stage="$1"
  local base_initial="$artifact_dir/map-${stage}-base-initial.png"
  local base="$artifact_dir/map-${stage}-base.png"
  local overlays="$artifact_dir/map-${stage}-overlays.png"
  for attempt in $(seq 1 45); do
    sleep 2
    adb shell uiautomator dump /sdcard/pluspuls-map.xml >/dev/null 2>&1 || true
    adb exec-out cat /sdcard/pluspuls-map.xml > "$ui_dump" 2>/dev/null || true
    if grep -q "map test $stage" "$ui_dump"; then
      tap_label "Heatmapa" "false"
      tap_label "Ruch drogowy" "false"
      tap_label "Trasy" "false"
      adb exec-out screencap -p > "$base_initial"
      sleep 3
      adb exec-out screencap -p > "$base"

      tap_label "Heatmapa" "true"
      tap_label "Ruch drogowy" "true"
      tap_label "Trasy" "true"
      adb exec-out screencap -p > "$overlays"
      adb shell uiautomator dump /sdcard/pluspuls-map.xml >/dev/null 2>&1
      adb exec-out cat /sdcard/pluspuls-map.xml > "$ui_dump"
      grep -q "map test $stage" "$ui_dump"

      # Analyze only after both camera-identical states are safely captured;
      # pure-Python PNG decoding must not consume the stage's dwell window.
      python3 scripts/map-smoke-tools.py analyze "$base"
      python3 scripts/map-smoke-tools.py stable "$base_initial" "$base" --max-ratio 0.04
      python3 scripts/map-smoke-tools.py count-colors "$overlays" \
        --color E11D48 --tolerance 15 --min-count 500
      python3 scripts/map-smoke-tools.py count-colors "$overlays" \
        --color F59E0B --tolerance 15 --min-count 100
      python3 scripts/map-smoke-tools.py count-colors "$overlays" \
        --color 06B6D4 --tolerance 15 --min-count 50
      python3 scripts/map-smoke-tools.py count-colors "$overlays" \
        --color 7C3AED --tolerance 15 --min-count 100
      return 0
    fi
  done
  echo "Timed out waiting for map test stage $stage" >&2
  return 1
}

mkdir -p "$artifact_dir"
test -f "$apk_path"
trap capture_failure ERR

adb wait-for-device
adb install -r "$apk_path"
adb shell pm grant "$package_name" android.permission.ACCESS_COARSE_LOCATION
adb shell pm grant "$package_name" android.permission.ACCESS_FINE_LOCATION
adb emu geo fix 19.9450 50.0647
adb logcat -c
adb shell am force-stop "$package_name"
adb shell am start -W -a android.intent.action.VIEW -d "pluspuls://map" "$package_name"

assert_zoom_stage "initial"
assert_zoom_stage "zoom-in"
assert_zoom_stage "zoom-out"

for attempt in $(seq 1 36); do
  sleep 5
  adb shell uiautomator dump /sdcard/pluspuls-map.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/pluspuls-map.xml > "$ui_dump" 2>/dev/null || true
  adb logcat -d | grep -E "FATAL EXCEPTION|API key not found|Authorization failure|Google Maps Android API.*failed" > "$filtered_log" || true

  if test -s "$filtered_log"; then
    cat "$filtered_log"
    exit 1
  fi

  if grep -q "zoom test OK" "$ui_dump" \
    && grep -q "GPS active" "$ui_dump" \
    && grep -q "drive_to_pickup" "$ui_dump" \
    && grep -Eq "[1-9][0-9]* heat" "$ui_dump" \
    && grep -Eq "[1-9][0-9]* dr" "$ui_dump" \
    && grep -Eq "[1-9][0-9]* tras" "$ui_dump"; then
    adb exec-out screencap -p > "$artifact_dir/map-smoke-overlays.png"

    tap_label "Heatmapa" "false"
    tap_label "Ruch drogowy" "false"
    tap_label "Trasy" "false"
    adb exec-out screencap -p > "$artifact_dir/map-smoke-base-initial.png"
    sleep 3
    adb exec-out screencap -p > "$artifact_dir/map-smoke-base.png"
    python3 scripts/map-smoke-tools.py analyze "$artifact_dir/map-smoke-base.png"
    python3 scripts/map-smoke-tools.py stable \
      "$artifact_dir/map-smoke-base-initial.png" "$artifact_dir/map-smoke-base.png" --max-ratio 0.04

    tap_label "Heatmapa" "true"
    adb exec-out screencap -p > "$artifact_dir/map-smoke-heat.png"
    python3 scripts/map-smoke-tools.py colors "$artifact_dir/map-smoke-base.png" "$artifact_dir/map-smoke-heat.png" \
      --color E11D48 --tolerance 15 --min-delta 1000
    tap_label "Heatmapa" "false"

    tap_label "Trasy" "true"
    adb exec-out screencap -p > "$artifact_dir/map-smoke-routes.png"
    python3 scripts/map-smoke-tools.py colors "$artifact_dir/map-smoke-base.png" "$artifact_dir/map-smoke-routes.png" \
      --color 7C3AED --tolerance 15 --min-delta 250
    tap_label "Trasy" "false"

    tap_label "Ruch drogowy" "true"
    adb exec-out screencap -p > "$artifact_dir/map-smoke-traffic.png"
    python3 scripts/map-smoke-tools.py colors "$artifact_dir/map-smoke-base.png" "$artifact_dir/map-smoke-traffic.png" \
      --color F59E0B --color 06B6D4 --tolerance 15 --min-delta 500
    tap_label "Heatmapa" "true"
    tap_label "Trasy" "true"
    adb exec-out screencap -p > "$artifact_dir/map-smoke-passed.png"

    adb logcat -d | grep -E "FATAL EXCEPTION|API key not found|Authorization failure|Google Maps Android API.*failed" > "$filtered_log" || true
    test ! -s "$filtered_log"
    trap - ERR
    echo "Native map smoke passed: readable Google tiles, GPS route, zoom, heat, traffic, and route pixels verified."
    exit 0
  fi

  echo "Waiting for native map smoke (${attempt}/36)..."
done

capture_failure
cat "$ui_dump" || true
exit 1
