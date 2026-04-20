import { AppLayout } from "@/components/AppLayout";
import { CrashGame } from "@/components/CrashGame";
import { useDiveEngine } from "@/store/crashEngine";
import { ArrowLeft, Anchor } from "lucide-react";
import { Link } from "react-router-dom";

const Dive = () => {
  return (
    <AppLayout>
      <Link
        to="/games"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to games
      </Link>

      <CrashGame
        name="Deepdive"
        txTag="Deepdive"
        useEngine={useDiveEngine}
        accent="var(--win)"
        renderBackground={() => (
          <>
            {/* underwater gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/5 to-background" />
            {/* bubbles rising */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute rounded-full border border-primary/40 bg-primary/10 animate-bubble"
                  style={{
                    bottom: `-20px`,
                    left: `${(i * 73) % 100}%`,
                    width: `${6 + (i % 4) * 3}px`,
                    height: `${6 + (i % 4) * 3}px`,
                    animationDelay: `${(i % 8) * 0.6}s`,
                    animationDuration: `${4 + (i % 5)}s`,
                  }}
                />
              ))}
            </div>
          </>
        )}
        renderVehicle={({ multiplier, phase }) => {
          // Submarine dives DOWN-right (inverse of plane)
          const p = Math.min(1, (multiplier - 1) / 6);
          const x = 8 + p * 78;
          const y = 80 - Math.pow(p, 0.7) * 70; // starts high, goes deeper
          const angle = phase === "crashed" ? -45 : 15 + p * 20;

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
                  className="absolute -z-10 h-1.5 rounded-full bg-gradient-to-l from-win/60 to-transparent blur-sm"
                  style={{
                    width: `${40 + p * 70}px`,
                    right: "70%",
                    top: "50%",
                  }}
                />
              )}
              <Anchor
                className={`h-12 w-12 ${
                  phase === "crashed" ? "text-lose" : "text-win"
                } drop-shadow-[0_0_12px_currentColor]`}
                strokeWidth={2.5}
              />
            </div>
          );
        }}
      />
    </AppLayout>
  );
};

export default Dive;
