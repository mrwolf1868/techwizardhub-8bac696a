import { useEffect } from "react";
import { useUserStore } from "@/store/userStore";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { AgreementGate } from "./AgreementGate";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const init = useUserStore((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
      <AgreementGate />
    </div>
  );
};
