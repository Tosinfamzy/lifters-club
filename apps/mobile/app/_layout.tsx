import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import * as Sentry from "@sentry/react-native";
import { tokenCache } from "../lib/clerk";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { OfflineProvider } from "../providers/offline-provider";
import { UserProvider } from "../providers/user-provider";

// Initialize Sentry before any other module-level work so that the
// publishableKey throw below (and any other early failure) is captured.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.EXPO_PUBLIC_ENV ?? (__DEV__ ? "development" : "production"),
    release: process.env.EXPO_PUBLIC_SENTRY_RELEASE,

    // Capture every error; sample traces conservatively in prod.
    sampleRate: 1.0,
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,

    // PII strip mirrors the server app: no Authorization tokens / cookies
    // make it into Sentry events even if some request library leaks them.
    beforeSend(event) {
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        delete headers.authorization;
        delete headers.Authorization;
        delete headers.cookie;
        delete headers.Cookie;
      }
      return event;
    },
  });
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60, // 1 hour
    },
    mutations: {
      retry: 3,
    },
  },
});

function InitialLayout() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#F8FAFC",
        contentStyle: { backgroundColor: "#0F172A" },
        headerShown: false,
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="workout/[id]"
        options={{
          headerShown: true,
          title: "Workout",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="exercise-alternatives/[exerciseId]"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="exercise-info/[exerciseId]"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="workout-detail/[logId]"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
    </Stack>
  );
}

function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <OfflineProvider>
          <UserProvider>
            <ErrorBoundary>
              <StatusBar style="light" />
              <InitialLayout />
            </ErrorBoundary>
          </UserProvider>
        </OfflineProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

// Sentry.wrap enables touch event tracking, navigation breadcrumbs (when
// the navigation integration is added), and profiling. Required for full
// React Native instrumentation.
export default Sentry.wrap(RootLayout);
