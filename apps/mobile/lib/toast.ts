import { Alert, Platform, ToastAndroid } from "react-native";

/**
 * Show a brief toast message to the user.
 * Uses ToastAndroid on Android; on iOS, logs to console (no native toast).
 */
export function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
  // iOS has no native toast — callers should use Alert.alert for critical messages
}

/**
 * Show an error to the user with optional logging context.
 * Uses Alert on iOS, ToastAndroid on Android.
 */
export function showError(message: string, context?: string) {
  console.error(context ? `[${context}] ${message}` : message);
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.LONG);
  } else {
    Alert.alert("Error", message);
  }
}
