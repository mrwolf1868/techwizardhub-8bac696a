import { NavLink } from "react-router-dom";
import { Home, Gamepad2, Rocket, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/games", label: "Games", icon: Gamepad2 },
  { to: "/deploy", label: "Deploy", icon: Rocket },
  { to: "/buy", label: "Buy", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_hsl(var(--primary))]")}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
