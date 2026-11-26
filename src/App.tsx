import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Games from "./pages/Games.tsx";
import GameMatch from "./pages/GameMatch.tsx";
import Services from "./pages/Services.tsx";
import ServiceLauncher from "./pages/ServiceLauncher.tsx";
import Buy from "./pages/Buy.tsx";
import Profile from "./pages/Profile.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import Admin from "./pages/Admin.tsx";
import CoinTrade from "./pages/CoinTrade.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 24 * 60 * 60_000, refetchOnWindowFocus: false } } });

// Remember public, non-personal data (site settings, service list) between visits so pages open instantly.
const PERSISTED_KEYS = new Set(["app-settings", "service-catalog"]);
const persister = typeof window === "undefined" ? undefined : createSyncStoragePersister({ storage: window.localStorage, key: "twp-cache" });
const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60_000,
  buster: "v1",
  dehydrateOptions: { shouldDehydrateQuery: (q: { queryKey: readonly unknown[]; state: { status: string } }) => q.state.status === "success" && PERSISTED_KEYS.has(String(q.queryKey[0])) },
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/" element={<Index />} />
      <Route path="/games" element={<Games />} />
      <Route path="/games/match/:id" element={<GameMatch />} />
      <Route path="/games/:game" element={<Games />} />
      <Route path="/trade" element={<CoinTrade />} />
      <Route path="/services" element={<Services />} />
      <Route path="/s/:slug" element={<ServiceLauncher />} />
      <Route path="/buy" element={<Buy />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </>,
  ),
);

const App = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" richColors />
      <RouterProvider router={router} />
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
