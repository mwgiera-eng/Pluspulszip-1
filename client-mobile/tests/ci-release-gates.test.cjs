const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflows = path.resolve(root, "..", ".github", "workflows");
const ci = fs.readFileSync(path.join(workflows, "mobile-ci.yml"), "utf8");
const release = fs.readFileSync(path.join(workflows, "mobile-release.yml"), "utf8");
const smoke = fs.readFileSync(path.join(root, "scripts", "android-map-smoke.sh"), "utf8");
const visualGate = fs.readFileSync(path.join(root, "scripts", "map-smoke-tools.py"), "utf8");

test("push CI executes a real API 36 native map smoke", () => {
  assert.match(ci, /Native map emulator smoke/);
  assert.match(ci, /GOOGLE_MAPS_ANDROID_CI_API_KEY/);
  assert.match(ci, /api-level: 36/);
  assert.match(ci, /EXPO_PUBLIC_MAP_TEST_MODE: "true"/);
  assert.match(ci, /android-map-smoke\.sh/);
  assert.match(ci, /npm run audit:ci/);
  assert.match(ci, /pinned temporary Expo\/Metro waiver/);
  assert.match(smoke, /pluspuls:\/\/map/);
  assert.match(smoke, /zoom test OK/);
  assert.match(smoke, /GPS active/);
  assert.match(smoke, /drive_to_pickup/);
  assert.match(smoke, /map-smoke-tools\.py analyze/);
  assert.match(smoke, /map-smoke-tools\.py colors/);
  assert.match(smoke, /map-smoke-tools\.py stable/);
  assert.match(smoke, /assert_zoom_stage "initial"/);
  assert.match(smoke, /assert_zoom_stage "zoom-in"/);
  assert.match(smoke, /assert_zoom_stage "zoom-out"/);
  assert.match(smoke, /map-\$\{stage\}-base\.png/);
  assert.match(smoke, /map-\$\{stage\}-overlays\.png/);
  assert.match(smoke, /Heatmapa/);
  assert.match(smoke, /Ruch drogowy/);
  assert.match(visualGate, /map brightness/);
  assert.match(visualGate, /textured-block ratio/);
  assert.match(visualGate, /overlay target-color delta/);
  assert.match(visualGate, /stable-map changed ratio/);
  assert.ok(smoke.includes("[1-9][0-9]* heat"));
  assert.match(smoke, /FATAL EXCEPTION/);
  assert.match(smoke, /Authorization failure/);
});

test("Play AAB workflow automatically builds only the exact green android push", () => {
  assert.match(release, /push:/);
  assert.match(release, /branches: \[android\]/);
  assert.match(release, /head_sha="\$GITHUB_SHA"/);
  assert.match(release, /select\(\.name == "Mobile CI" and \.path == "\.github\/workflows\/mobile-ci\.yml"\)/);
  assert.match(release, /\.path == "\.github\/workflows\/mobile-ci\.yml"/);
  assert.match(release, /required_jobs/);
  assert.match(release, /test "\$conclusion" != "success"/);
  assert.match(release, /Mobile CI run \$run_id for \$GITHUB_SHA concluded \$conclusion/);
  assert.doesNotMatch(release, /env:pull/);
  assert.match(release, /npm run verify:release/);
  assert.match(release, /eas-cli@21\.8\.0 build --platform android --profile production --non-interactive --wait/);
});

test("third-party workflow actions are pinned to immutable SHAs", () => {
  const actionRefs = `${ci}\n${release}`.match(/uses:\s+[^\s#]+/g) ?? [];
  assert.ok(actionRefs.length >= 8);
  for (const reference of actionRefs) {
    assert.match(reference, /@[0-9a-f]{40}$/);
  }
});
