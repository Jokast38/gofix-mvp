import { useEffect } from "react";
import { Platform } from "react-native";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold } from "@expo-google-fonts/tajawal";
import { PushPrompt } from "@/components/PushPrompt";
import { TourProvider } from "@/components/tour";
import { AuthProvider } from "@/hooks/auth";
import { appRoute, Notifications } from "@/lib/push";
import { I18nProvider, useI18n } from "@/i18n";
import { ThemeProvider, useTheme } from "@/theme";
import { ToastProvider } from "@/ui";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

/** Tapping a push opens the related screen; a push received while the app is open refreshes the notification list. */
function usePushNavigation() {
  const qc = useQueryClient();
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    const open = (response) => {
      const link = response?.notification?.request?.content?.data?.link;
      if (response) setTimeout(() => router.push(appRoute(link)), 300);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    // A push while the app is open: refresh at once instead of waiting for the periodic refresh.
    const received = Notifications.addNotificationReceivedListener(() => {
      for (const key of ["notifications", "conversations", "conversation", "inbox", "my-requests", "jobs"]) qc.invalidateQueries({ queryKey: [key] });
    });
    return () => { tapped.remove(); received.remove(); };
  }, [qc]);
}

function Shell() {
  const { c, name } = useTheme();
  usePushNavigation();
  const { ready } = useI18n();
  // Tajawal is bundled in the app (no font CDN): used for Arabic text.
  const [fontsLoaded] = useFonts({ Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold });
  useEffect(() => {
    if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, ready]);
  if (!fontsLoaded || !ready) return null;
  return (
    <>
      <StatusBar style={name === "light" ? "dark" : "light"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: "slide_from_right" }} />
      <PushPrompt />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <ToastProvider>
                <TourProvider>
                  <Shell />
                </TourProvider>
              </ToastProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
