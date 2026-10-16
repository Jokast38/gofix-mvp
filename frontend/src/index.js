import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/800.css";
import "@/index.css";
import App from "@/App";
import { I18nProvider } from "@/i18n";
import { ThemeProvider } from "@/hooks/ThemeProvider";
import { AuthProvider } from "@/hooks/AuthProvider";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 2, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
