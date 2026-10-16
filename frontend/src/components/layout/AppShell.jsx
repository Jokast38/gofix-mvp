import { useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { CookieBanner } from "./CookieBanner";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { TourProvider } from "@/components/tour/TourProvider";

// App-like screens: no marketing footer on mobile (it would sit in the middle of the viewport).
const APP_ROUTES = ["/messages", "/dashboard", "/requests", "/favorites", "/account", "/payment", "/jobs"];

export default function AppShell({ children }) {
  const { pathname } = useLocation();
  const appRoute = APP_ROUTES.some((r) => pathname.startsWith(r));
  return (
    <TourProvider>
    <div className="relative min-h-screen flex flex-col overflow-x-hidden">
      <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden">
        <div className="gf-halo w-[420px] h-[420px] -top-32 -start-24" style={{ background: "var(--brand-electric)" }} />
        <div className="gf-halo w-[380px] h-[380px] top-1/3 -end-32" style={{ background: "var(--brand-pink)" }} />
        <div className="gf-halo w-[360px] h-[360px] bottom-0 start-1/4" style={{ background: "var(--brand-violet)" }} />
      </div>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip
      </a>
      <Header />
      <main id="main" className="flex-1 pb-24 md:pb-0">{children}</main>
      <div className={appRoute ? "hidden md:block" : undefined}><Footer /></div>
      <BottomNav />
      <ChatBubble />
      <CookieBanner />
    </div>
    </TourProvider>
  );
}
