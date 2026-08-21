const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "components", "MapExperience.native.tsx"), "utf8");
const screen = fs.readFileSync(path.join(root, "app", "(tabs)", "map.tsx"), "utf8");
const heatHook = fs.readFileSync(path.join(root, "hooks", "use-live-heat.ts"), "utf8");

test("Android map is native and has no WebView/Leaflet rendering path", () => {
  assert.match(source, /from "react-native-maps"/);
  assert.match(source, /<MapView/);
  assert.doesNotMatch(source, /react-native-webview|<WebView|leaflet|cartocdn/i);
});

test("native geographic layers and GPS route fitting are wired", () => {
  assert.match(source, /<Polygon/);
  assert.match(source, /<Polyline/);
  assert.match(source, /<Marker/);
  assert.match(source, /<Circle/);
  assert.match(source, /fitToCoordinates/);
  assert.match(source, /showsUserLocation/);
  assert.match(source, /drive_to_pickup/);
  assert.match(source, /testID="map-render-status"/);
});

test("zoom stability and visible route-bound signals are regression-gated", () => {
  assert.match(source, /onMapLoaded/);
  assert.match(source, /onRegionChangeComplete/);
  assert.match(source, /EXPO_PUBLIC_MAP_TEST_MODE/);
  assert.match(source, /zoom test OK/);
  assert.match(source, /map test \$\{zoomTestStage\}/);
  assert.match(source, /GPS active/);
  assert.match(source, /focusRoute\?\.role/);
  assert.match(source, /tracksViewChanges=\{false\}/);
  assert.match(source, /`\$\{road\.id\}-\$\{index\}-\$\{color\}`/);
  assert.match(source, /strokeColor=\{trafficColor\(road\.intensity\)\}/);
  assert.match(source, /backgroundColor: signal\.color/);
  assert.match(source, /strokeColor=\{color\.stroke\}/);
  assert.match(source, /strokeColor=\{appearance\.color\}/);
  assert.doesNotMatch(source, /mapTestMode \? ["']#[0-9A-Fa-f]{6}/);
  assert.match(source, /const TrafficSignals = memo/);
  assert.doesNotMatch(source, /nextKey = `\$\{focus\.id\}:\$\{position/);
});

test("only useful layers are exposed", () => {
  assert.match(source, /type LayerId = "heat" \| "traffic" \| "routes"/);
  assert.doesNotMatch(source, /LayerId = .*points|LayerId = .*zones/);
});

test("manual refresh retries heat, traffic, and GPS routes and exposes degraded GPS routing", () => {
  assert.match(screen, /refreshAllMapData/);
  assert.match(screen, /setMapRefreshToken/);
  assert.match(screen, /refreshToken=\{mapRefreshToken\}/);
  assert.match(source, /refreshToken = 0/);
  assert.match(source, /position\?\.lat, position\?\.lng, refreshToken/);
  assert.match(source, /!nextRoutes\.some\(\(route\) => route\.role === "drive_to_pickup"\)/);
  assert.match(source, /Trasa GPS jest chwilowo niedostępna/);
  assert.match(heatHook, /setLoading\(true\)/);
});
