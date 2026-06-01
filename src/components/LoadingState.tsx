import { useEffect, useState } from "react";
import adLabLogo from "@/assets/ad-lab-logo.png";

interface LoadingStateProps {
  businessName: string;
  elapsedSeconds: number;
}

const stages = [
  { label: "Analyzing traffic patterns", icon: "📊" },
  { label: "Mapping channel distribution", icon: "🗺️" },
  { label: "Evaluating competitor landscape", icon: "🔍" },
  { label: "Generating keyword insights", icon: "🔑" },
  { label: "Building executive summary", icon: "📝" },
  { label: "Compiling geographic data", icon: "🌍" },
  { label: "Crafting action plan", icon: "🚀" },
];

const LoadingState = ({ businessName, elapsedSeconds }: LoadingStateProps) => {
  const [stageIndex, setStageIndex] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((i) => (i + 1) % stages.length);
      setFadeKey((k) => k + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const progress = Math.min((elapsedSeconds / 300) * 100, 95);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background blueprint-grid">
      <div className="text-center max-w-md mx-auto px-6 animate-fade-in">
        {/* Logo with concentric rings */}
        <div className="relative mb-12 flex items-center justify-center h-[200px]">
          <div className="loading-ring loading-ring-1 absolute" />
          <div className="loading-ring loading-ring-2 absolute" />
          <div className="loading-ring loading-ring-3 absolute" />
          <img
            src={adLabLogo}
            alt="Ad-Lab"
            className="h-14 w-14 relative z-10 rounded-[4px] object-cover"
          />
        </div>

        {/* Title */}
        <span className="type-eyebrow text-primary block mb-3">[ Processing ]</span>
        <h2 className="text-2xl text-foreground mb-2">
          Generating Report
        </h2>
        <p className="micro-label-lg text-muted-foreground">
          for — {businessName}
        </p>

        {/* Progress bar */}
        <div className="mt-10 w-full h-[3px] bg-border overflow-hidden rounded-[4px]">
          <div
            className="h-full transition-all duration-1000 ease-out relative overflow-hidden bg-primary"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 animate-[progress-shimmer_2s_ease-in-out_infinite]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)", width: "50%" }}
            />
          </div>
        </div>

        {/* Current stage */}
        <div className="mt-7 h-7" key={fadeKey}>
          <p className="type-eyebrow text-foreground animate-[fade-in_0.4s_ease-out_both] flex items-center justify-center gap-2.5">
            <span className="text-primary tabular-nums">{String(stageIndex + 1).padStart(2, "0")}</span>
            <span className="w-3 h-px bg-border" />
            {stages[stageIndex].label}
          </p>
        </div>

        {/* Stage ticks */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          {stages.map((_, i) => (
            <div
              key={i}
              className="h-px w-5 transition-all duration-300"
              style={{
                background: i === stageIndex ? "hsl(var(--primary))" : i < stageIndex ? "hsl(var(--primary) / 0.35)" : "hsl(var(--border))"
              }}
            />
          ))}
        </div>

        {/* Info box */}
        <div className="mt-10 border border-border bg-card rounded-[4px] p-5 text-left relative">
          <span className="micro-label absolute top-2.5 right-3">est. ~5 min</span>
          <p className="text-xs text-muted-foreground tracking-[0.02em] leading-relaxed">
            You can close this page — your report will be saved automatically.
          </p>
          <p className="micro-label-lg text-primary mt-3 tabular-nums">
            {minutes}:{seconds} elapsed
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
