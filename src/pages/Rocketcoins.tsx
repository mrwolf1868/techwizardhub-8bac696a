import { AppLayout } from "@/components/AppLayout";
import { CrashGame } from "@/components/CrashGame";
import { useRocketEngine } from "@/store/crashEngine";
import { ArrowLeft, Rocket } from "lucide-react";
import { Link } from "react-router-dom";

const Rocketcoins = () => {
  return (
    <AppLayout>
      <Link
        to="/games"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to games
      </Link>

      <CrashGame
        name="Rocketcoins"
        txTag="Rocketcoins"
        useEngine={useRocketEngine}
        accent="var(--accent)"
        renderBackground={() => (
          <>
            {/* deep space gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-primary/10" />
            {/* stars */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 40 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute h-0.5 w-0.5 rounded-full bg-foreground animate-twinkle"
                  style={{
                    top: `${(i * 37) % 100}%`,
                    left: `${(i * 53) % 100}%`,
                    animationDelay: `${(i % 7) * 0.4}s`,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          </>
        )}
        renderVehicle={({ multiplier, phase }) => {
          // Rocket goes mostly UP with slight rightward drift
          const p = Math.min(1, (multiplier - 1) / 6);
          const y = 8 + p * 78;
          const x = 35 + p * 25;
          const angle = phase === "crashed" ? 180 : -8;

          return (
            <div
              className="absolute pointer-events-none transition-all"
              style={{
                bottom: `${y}%`,
                left: `${x}%`,
                transform: `translate(-50%, 50%) rotate(${angle}deg)`,
                transitionDuration: phase === "crashed" ? "600ms" : "120ms",
                transitionTimingFunction: "linear",
              }}
            >
              {phase === "flying" && (
                <div
                  className="absolute left-1/2 top-full -translate-x-1/2 rounded-full bg-gradient-to-b from-accent via-coin/60 to-transparent blur-sm"
                  style={{
                    height: `${30 + p * 80}px`,
                    width: "10px",
                  }}
                />
              )}
              <Rocket
                className={`h-12 w-12 ${
                  phase === "crashed" ? "text-lose" : "text-accent"
                } drop-shadow-[0_0_14px_currentColor]`}
                strokeWidth={2.5}
              />
            </div>
          );
        }}
      />
    </AppLayout>
  );
};

export default Rocketcoins;
