import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

/** The signature frosted-glass surface from the YouTube report template. */
export function GlassPanel({ children, className }: GlassPanelProps) {
  return <div className={cn("cos-glass rounded-2xl", className)}>{children}</div>;
}
