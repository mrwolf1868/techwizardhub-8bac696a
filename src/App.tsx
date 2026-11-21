import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUserStore } from "@/store/userStore";
import Index from "./pages/Index.tsx";
import Games from "./pages/Games.tsx";
import GameMatch from "./pages/GameMatch.tsx";
import Deploy from "./pages/Deploy.tsx";
import Services from "./pages/Services.tsx";
import ServiceLauncher from "./pages/ServiceLauncher.tsx";
import Buy from "./pages/Buy.tsx";
import Profile from "./pages/Profile.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import Admin from "./pages/Admin.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const ReferralCapture = () => {
  const init = useUserStore((s) => s.init);
  const initialized = useUserStore((s) => s.initialized);
  const applyPendingReferral = useUserStore((s) => s.applyPendingReferral);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const wasNew = !initialized;
    init();
    if (ref) {
      localStorage.setItem("twh-pending-ref", ref.toUpperCase());
      if (wasNew) applyPendingReferral(ref);
    }
    if (ref) {
      params.delete("ref");
      const qs = params.toString();
      const newUrl =
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  }, [init, initialized, applyPendingReferral]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" richColors />
      <BrowserRouter>
        <ReferralCapture />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/" element={<Index />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/match/:id" element={<GameMatch />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/services" element={<Services />} />
          <Route path="/s/:slug" element={<ServiceLauncher />} />
          <Route path="/buy" element={<Buy />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
