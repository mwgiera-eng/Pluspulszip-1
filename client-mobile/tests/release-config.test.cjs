const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));
const packageLock = require(path.join(root, "package-lock.json"));
const appJson = require(path.join(root, "app.json"));
const easJson = require(path.join(root, "eas.json"));
const configureApp = require(path.join(root, "app.config.js"));

test("release version and native map dependency are locked", () => {
  assert.equal(packageJson.version, appJson.expo.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
  assert.equal(packageJson.dependencies["react-native-maps"], "1.27.2");
  assert.equal(packageLock.packages["node_modules/react-native-maps"].version, "1.27.2");
});

test("the remote EAS builder cannot configure production without a Google Maps key", () => {
  const previousChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
  const previousKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const previousEasBuild = process.env.EAS_BUILD;
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL = "production";
  process.env.EAS_BUILD = "true";
  delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  try {
    assert.throws(() => configureApp({ config: appJson.expo }), /GOOGLE_MAPS_ANDROID_API_KEY/);
  } finally {
    if (previousChannel === undefined) delete process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
    else process.env.EXPO_PUBLIC_RELEASE_CHANNEL = previousChannel;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = previousKey;
    if (previousEasBuild === undefined) delete process.env.EAS_BUILD;
    else process.env.EAS_BUILD = previousEasBuild;
  }
});

test("the local EAS submission pass can resolve config before remote secrets load", () => {
  const previousChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
  const previousKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const previousEasBuild = process.env.EAS_BUILD;
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL = "production";
  delete process.env.EAS_BUILD;
  delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  try {
    const configured = configureApp({ config: appJson.expo });
    const mapPlugin = configured.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "react-native-maps");
    assert.deepEqual(mapPlugin, ["react-native-maps", { androidGoogleMapsApiKey: "MISSING_GOOGLE_MAPS_ANDROID_API_KEY" }]);
  } finally {
    if (previousChannel === undefined) delete process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
    else process.env.EXPO_PUBLIC_RELEASE_CHANNEL = previousChannel;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = previousKey;
    if (previousEasBuild === undefined) delete process.env.EAS_BUILD;
    else process.env.EAS_BUILD = previousEasBuild;
  }
});

test("preview also fails closed unless a real Maps key is provided", () => {
  const previousChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
  const previousKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL = "preview";
  delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  try {
    assert.throws(() => configureApp({ config: appJson.expo }), /GOOGLE_MAPS_ANDROID_API_KEY/);
  } finally {
    if (previousChannel === undefined) delete process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
    else process.env.EXPO_PUBLIC_RELEASE_CHANNEL = previousChannel;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = previousKey;
  }
});

test("CI validation can resolve config without embedding a production Maps key", () => {
  const previousChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
  const previousKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL = "ci";
  delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  try {
    const configured = configureApp({ config: appJson.expo });
    const mapPlugin = configured.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "react-native-maps");
    assert.deepEqual(mapPlugin, ["react-native-maps", { androidGoogleMapsApiKey: "MISSING_GOOGLE_MAPS_ANDROID_API_KEY" }]);
  } finally {
    if (previousChannel === undefined) delete process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
    else process.env.EXPO_PUBLIC_RELEASE_CHANNEL = previousChannel;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = previousKey;
  }
});

test("Google Maps key is injected only through build environment", () => {
  const previousChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
  const previousKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL = "production";
  process.env.GOOGLE_MAPS_ANDROID_API_KEY = "ci-test-key-not-a-secret";
  try {
    const configured = configureApp({ config: appJson.expo });
    const mapPlugin = configured.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "react-native-maps");
    assert.deepEqual(mapPlugin, ["react-native-maps", { androidGoogleMapsApiKey: "ci-test-key-not-a-secret" }]);
  } finally {
    if (previousChannel === undefined) delete process.env.EXPO_PUBLIC_RELEASE_CHANNEL;
    else process.env.EXPO_PUBLIC_RELEASE_CHANNEL = previousChannel;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = previousKey;
  }
  const committedConfig = fs.readFileSync(path.join(root, "app.json"), "utf8") + fs.readFileSync(path.join(root, "eas.json"), "utf8");
  assert.doesNotMatch(committedConfig, /AIza[0-9A-Za-z_-]{20,}/);
});

test("production profile creates an auto-incremented Play bundle", () => {
  assert.equal(easJson.cli.requireCommit, true);
  assert.equal(easJson.build.production.android.buildType, "app-bundle");
  assert.equal(easJson.build.production.autoIncrement, true);
  assert.equal(easJson.build.production.environment, "production");
  assert.equal(easJson.build.production.env.EXPO_PUBLIC_RELEASE_CHANNEL, "production");
  assert.equal(easJson.build.production.env.EXPO_PUBLIC_MAP_TEST_MODE, "false");
});

test("EAS cannot archive generated native trees or local secrets", () => {
  const gitIgnore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  const easIgnore = fs.readFileSync(path.join(root, ".easignore"), "utf8");
  for (const rule of ["/android", "/ios", ".env", "*.jks", "*.keystore", "google-services.json", "credentials.json"]) {
    assert.match(gitIgnore, new RegExp(`^${rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
    assert.match(easIgnore, new RegExp(`^${rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }
});

test("release verifier checks all untracked files and rejects native directories", () => {
  const verifier = fs.readFileSync(path.join(root, "scripts", "verify-release.cjs"), "utf8");
  assert.match(verifier, /--untracked-files=all/);
  assert.match(verifier, /fs\.existsSync/);
  assert.match(verifier, /client-mobile\/android/);
  assert.match(verifier, /client-mobile\/ios/);
  assert.match(verifier, /exactGithubAndroidPush/);
  assert.doesNotMatch(verifier, /--untracked-files=no/);
});
