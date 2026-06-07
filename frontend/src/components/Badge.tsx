import type { ReactNode } from "react";

type BadgeTone = "neutral" | "good" | "warning" | "danger" | "info";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function toneForOutlook(outlook?: string): BadgeTone {
  const normalized = outlook?.toLowerCase() ?? "";
  if (normalized.includes("bullish") || normalized.includes("positive")) return "good";
  if (normalized.includes("bearish") || normalized.includes("negative")) return "danger";
  if (normalized.includes("mixed") || normalized.includes("neutral")) return "warning";
  return "info";
}

export function toneForRisk(risk?: string): BadgeTone {
  const normalized = risk?.toLowerCase() ?? "";
  if (normalized === "critical") return "danger";
  if (normalized === "high") return "warning";
  if (normalized === "medium") return "info";
  if (normalized === "low") return "good";
  return "neutral";
}
