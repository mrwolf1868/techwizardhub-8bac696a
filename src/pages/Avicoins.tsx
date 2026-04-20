import { AppLayout } from "@/components/AppLayout";
import { CrashGame } from "@/components/CrashGame";
import { useAvicoinsEngine } from "@/store/crashEngine";
import { ArrowLeft, Plane } from "lucide-react";
import { Link } from "react-router-dom";

const Avicoins = () => {
  return (
    <AppLayout>
      <Link
        to="/games"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to games
      </Link>

      <CrashGame
        name="Avicoins"
        txTag="Avicoins"
        useEngine={useAvicoinsEngine}
        accent="var(--primary)"
        renderBackground={() => (
          <>
            {/* sky grid */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--primary)/0.3) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--primary)/0.3) 1px,transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            {/* drifting clouds */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-6 left-[-10%] h-3 w-24 rounded-full bg-primary/10 blur-xl animate-cloud-drift" />
              <div className="absolute top-20 left-[-20%] h-4 w-40 rounded-full bg-primary/5 blur-2xl animate-cloud-drift-slow" />
              <div className="absolute bottom-12 left-[-15%] h-3 w-32 rounded-full bg-accent/10 blur-xl animate-cloud-drift" style={{ animationDelay: "-4s" }} />
            </div>
          </>
        )}
        renderVehicle={({ multiplier, phase }) => {
          // Plane follows a curved path: from bottom-left (10%,10%) climbing toward top-right.
          // We map progress = (multiplier - 1) clamped to a curve.
          const p = Math.min(1, (multiplier - 1) / 6); // saturates around 7x
          const x = 8 + p * 78; // % from left
          const y = 10 + Math.pow(p, 0.7) * 70; // % from bottom (eases up fast then slows)
          const angle =
            phase === "crashed"
              ? 75 // nose-dive
              : phase === "flying"
              ? -(20 + p * 25) // climbing harder over time
              : -10;

          return (
            <div
              className="absolute pointer-events-none transition-all"
              style={{
                bottom: `${y}%`,
                left: `${x}%`,
                transform: `translate(-50%, 50%) rotate(${angle}deg)`,
                transitionDuration: phase === "crashed" ? "600ms" : "120ms",
                transitionTimingFunction:
                  phase === "crashed" ? "cubic-bezier(0.5,0,0.9,0.5)" : "linear",
              }}
            >
              {/* exhaust trail */}
              {phase === "flying" && (
                <div
                  className="absolute -z-10 h-1.5 rounded-full bg-gradient-to-l from-primary via-primary/40 to-transparent blur-sm"
                  style={{
                    width: `${40 + p * 80}px`,
                    right: "70%",
                    top: "50%",
                    transform: "translateY(-50%) rotate(8deg)",
                  }}
                />
              )}
              <Plane
                className={`h-12 w-12 ${
                  phase === "crashed" ? "text-lose" : "text-primary"
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

export default Avicoins;
