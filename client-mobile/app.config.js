const MISSING_MAPS_KEY = "MISSING_GOOGLE_MAPS_ANDROID_API_KEY";

module.exports = ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  const releaseChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL?.trim();
  // The production key lives only in the EAS build environment. The local EAS
  // submission pass may evaluate this config before that environment is loaded;
  // the remote builder evaluates it again with EAS_BUILD=true and must fail closed.
  const keyRequired = process.env.EAS_BUILD === "true" || new Set(["development", "preview"]).has(releaseChannel);

  if (!mapsKey && keyRequired) {
    throw new Error(
      "GOOGLE_MAPS_ANDROID_API_KEY is required for Android builds. Configure a certificate-restricted key in the EAS build environment.",
    );
  }

  const plugins = (config.plugins ?? []).filter((plugin) =>
    Array.isArray(plugin) ? plugin[0] !== "react-native-maps" : plugin !== "react-native-maps",
  );

  plugins.push([
    "react-native-maps",
    { androidGoogleMapsApiKey: mapsKey || MISSING_MAPS_KEY },
  ]);

  return { ...config, plugins };
};
