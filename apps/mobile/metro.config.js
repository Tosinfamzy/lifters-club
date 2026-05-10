// Metro config wrapped by Sentry's helper so source maps and debug IDs are
// emitted during `eas build`. Without this wrapper the bundle still works,
// but production stack traces from Sentry won't symbolicate.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
