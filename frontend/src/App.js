import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import Home from "@/pages/Home";

const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const PasswordReset = lazy(() => import("@/pages/PasswordReset"));
const Account = lazy(() => import("@/pages/Account"));
const Admin = lazy(() => import("@/pages/admin/Admin"));
const Legal = lazy(() => import("@/pages/Legal"));
const Faq = lazy(() => import("@/pages/Faq"));
const Contact = lazy(() => import("@/pages/Contact"));
const AppLanding = lazy(() => import("@/pages/AppLanding"));
const ComingSoon = lazy(() => import("@/pages/ComingSoon"));
const Onboarding = lazy(() => import("@/pages/onboarding/Onboarding"));
const ChooseKind = lazy(() => import("@/pages/onboarding/Onboarding").then((m) => ({ default: m.ChooseKind })));
const Search = lazy(() => import("@/pages/Search"));
const Academy = lazy(() => import("@/pages/Academy"));
const ProfileDetail = lazy(() => import("@/pages/ProfileDetail"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const PaymentMock = lazy(() => import("@/pages/Payment").then((m) => ({ default: m.PaymentMock })));
const PaymentResult = lazy(() => import("@/pages/Payment").then((m) => ({ default: m.PaymentResult })));
const Billing = lazy(() => import("@/pages/Billing"));
const Messages = lazy(() => import("@/pages/Messages"));
const Favorites = lazy(() => import("@/pages/Favorites"));
const Requests = lazy(() => import("@/pages/Requests"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Jobs = lazy(() => import("@/pages/Jobs"));
const JobDetail = lazy(() => import("@/pages/Jobs").then((m) => ({ default: m.JobDetail })));

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<PasswordReset />} />
            <Route path="/reset-password" element={<PasswordReset />} />
            <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute admin><Admin /></ProtectedRoute>} />
            <Route path="/legal/:slug" element={<Legal />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/app" element={<AppLanding />} />
            <Route path="/search" element={<Search />} />
            <Route path="/academy" element={<Academy />} />
            <Route path="/pro/join" element={<ChooseKind />} />
            <Route path="/pro/join/:kind" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/pro/:id" element={<ProfileDetail kind="professional" />} />
            <Route path="/teacher/:id" element={<ProfileDetail kind="teacher" />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/payment/mock" element={<ProtectedRoute><PaymentMock /></ProtectedRoute>} />
            <Route path="/payment/result" element={<ProtectedRoute><PaymentResult /></ProtectedRoute>} />
            <Route path="/account/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/messages/:id" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}
