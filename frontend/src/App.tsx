import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { AuthInit, ProtectedRoute } from "@/components/AuthGuard";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { AuthCallback } from "@/pages/AuthCallback";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";
import { Dashboard } from "@/pages/Dashboard";
import { EventDetails } from "@/pages/EventDetails";
import { CrisisFeed } from "@/pages/CrisisFeed";
import { MarketIntelligence } from "@/pages/MarketIntelligence";
import { SourceAnalytics } from "@/pages/SourceAnalytics";
import { Assistant } from "@/pages/Assistant";
import { Executive } from "@/pages/Executive";
import { Settings } from "@/pages/Settings";
import { Profile } from "@/pages/Profile";
import { ThemeProvider } from "@/providers/ThemeProvider";
import "./styles.css";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
        <AuthInit>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Shell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/crisis-feed" element={<CrisisFeed />} />
                <Route path="/market-intelligence" element={<MarketIntelligence />} />
                <Route path="/source-analytics" element={<SourceAnalytics />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/executive" element={<Executive />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/events/:eventId" element={<EventDetails />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthInit>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
