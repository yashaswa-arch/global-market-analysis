export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function clampScore(score: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, score));
}

export function formatDate(isoDate?: string): string {
  if (!isoDate) return "Unknown";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function percent(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "N/A";
  return `${Math.round(clampScore(value))}%`;
}
