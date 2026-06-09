import type { Analysis, AssetConsensusSummary, Event, MarketImpact } from "@/types";

export const trackedAssets = [
  // Commodities
  "Gold", "Silver", "Copper", "Crude Oil", "Brent Oil", "Natural Gas",
  // Currencies
  "USD", "EUR", "GBP", "INR", "JPY", "CNY",
  // Crypto
  "Bitcoin", "Ethereum", "Solana", "BNB",
  // Indices
  "S&P 500", "NASDAQ", "Dow Jones", "NIFTY 50", "SENSEX", "FTSE 100", "DAX"
] as const;
export type TrackedAsset = typeof trackedAssets[number];

// Alternative spellings that should map to canonical asset names
export const ASSET_ALIASES: Record<string, TrackedAsset> = {
  "gold": "Gold",
  "silver": "Silver",
  "copper": "Copper",
  "crude oil": "Crude Oil",
  "crude": "Crude Oil",
  "wti": "Crude Oil",
  "oil": "Crude Oil",
  "brent oil": "Brent Oil",
  "brent": "Brent Oil",
  "natural gas": "Natural Gas",
  "natgas": "Natural Gas",
  "gas": "Natural Gas",
  "usd": "USD",
  "dollar": "USD",
  "us dollar": "USD",
  "eur": "EUR",
  "euro": "EUR",
  "gbp": "GBP",
  "pound": "GBP",
  "inr": "INR",
  "rupee": "INR",
  "indian rupee": "INR",
  "jpy": "JPY",
  "yen": "JPY",
  "cny": "CNY",
  "yuan": "CNY",
  "bitcoin": "Bitcoin",
  "btc": "Bitcoin",
  "ethereum": "Ethereum",
  "eth": "Ethereum",
  "solana": "Solana",
  "sol": "Solana",
  "bnb": "BNB",
  "nifty 50": "NIFTY 50",
  "nifty50": "NIFTY 50",
  "nifty": "NIFTY 50",
  "sensex": "SENSEX",
  "nasdaq": "NASDAQ",
  "s&p 500": "S&P 500",
  "sp 500": "S&P 500",
  "spx": "S&P 500",
  "dow jones": "Dow Jones",
  "dow": "Dow Jones",
  "djia": "Dow Jones",
  "ftse 100": "FTSE 100",
  "ftse": "FTSE 100",
  "dax": "DAX",
};

export const suggestedPrompts = [
  "Summarize the latest geopolitical risks affecting energy markets.",
  "What is the near-term outlook for Crude Oil and Gold based on recent events?",
  "Analyze the immediate impact of Middle East tensions on global shipping.",
  "Identify emerging regulatory threats to the technology sector.",
];

const riskWeights: Record<string, number> = {
  critical: 100,
  high: 74,
  medium: 52,
  low: 24,
};

export type CountItem = { label: string; count: number };

export type DashboardStats = {
  globalRiskScore: number;
  totalEvents: number;
  totalAnalyses: number;
  criticalEvents: number;
  highRiskEvents: number;
  topRiskCategories: CountItem[];
  sectorExposure: CountItem[];
  riskPosture: string;
};

export type CrisisFeedRow = {
  event: Event;
  analysis?: Analysis;
  score: number;
};

export type OutlookCard = {
  asset: string;
  overall_outlook: string;
  weighted_confidence: number;
  reasoning: string;
  supporting_events: { title: string; outlook: string; confidence?: number; reason?: string }[];
  conflicting_events: { title: string; outlook: string; confidence?: number; reason?: string }[];
};

export function buildDashboardStats(analyses: Analysis[], totalEvents: number, unanalyzedEvents = 0): DashboardStats {
  const riskBreakdown = analyses.reduce(
    (acc, analysis) => {
      const key = (analysis.risk_level ?? "low").toLowerCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>,
  );

  const weightedRisk = analyses.length
    ? Math.round(
        analyses.reduce((sum, analysis) => {
          const risk = (analysis.risk_level ?? "low").toLowerCase();
          return sum + (riskWeights[risk] ?? 24);
        }, 0) / analyses.length,
      )
    : 0;

  const criticalEvents = riskBreakdown.critical;
  const highRiskEvents = riskBreakdown.high;
  const analyzedCoverage = totalEvents ? Math.round(((analyses.length + unanalyzedEvents) / totalEvents) * 100) : 0;

  return {
    globalRiskScore: clampScore(weightedRisk + Math.min(criticalEvents * 3, 18)),
    totalEvents,
    totalAnalyses: analyses.length,
    criticalEvents,
    highRiskEvents,
    topRiskCategories: countBy(analyses.map((analysis) => analysis.category ?? "Unclassified"), 6),
    sectorExposure: countBy(analyses.flatMap((analysis) => analysis.affected_sectors ?? []), 6),
    riskPosture: postureForScore(weightedRisk, analyzedCoverage),
  };
}

export function buildCrisisFeedRows(events: Event[], analyses: Analysis[]): CrisisFeedRow[] {
  return events
    .map((event) => {
      let analysis = (event as any).analysis;
      if (Array.isArray(analysis)) {
        analysis = analysis[0];
      }
      if (!analysis) {
        analysis = findAnalysisForEvent(analyses, event.id);
      }
      return { event, analysis, score: eventPriority(event, analysis) };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildMarketIntelligenceCards(analyses: Analysis[]): OutlookCard[] {
  return trackedAssets.map((asset) => {
    const impacts = analyses.flatMap((analysis) =>
      (analysis.market_impacts ?? [])
        .filter((impact) => assetMatches(impact.asset, asset))
        .map((impact) => ({ impact, title: analysis.events?.title ?? analysis.summary ?? "Untitled event" })),
    );

    const supporting = impacts.filter(({ impact }) => isSupportive(impact));
    const conflicting = impacts.filter(({ impact }) => isConflicting(impact));
    const confidence = impacts.length
      ? impacts.reduce((sum, item) => sum + (item.impact.confidence ?? 0), 0) / impacts.length
      : 0;

    return {
      asset,
      overall_outlook: dominantOutlook(impacts.map((item) => item.impact)),
      weighted_confidence: confidence,
      reasoning: impacts[0]?.impact.reason ?? "No direct market impact evidence in analyzed events yet.",
      supporting_events: supporting.slice(0, 4).map(({ impact, title }) => ({
        title,
        outlook: impact.outlook,
        confidence: impact.confidence,
        reason: impact.reason,
      })),
      conflicting_events: conflicting.slice(0, 4).map(({ impact, title }) => ({
        title,
        outlook: impact.outlook,
        confidence: impact.confidence,
        reason: impact.reason,
      })),
    };
  });
}

export function buildConsensusRows(consensus: AssetConsensusSummary[]): OutlookCard[] {
  return consensus.map((item) => ({
    asset: item.asset,
    overall_outlook: item.overall_outlook,
    weighted_confidence: item.weighted_confidence,
    reasoning: item.reasoning,
    supporting_events: item.supporting_events.map((event) => ({
      title: event.title ?? "Untitled event",
      outlook: event.outlook,
      confidence: event.confidence,
      reason: event.reason,
    })),
    conflicting_events: item.conflicting_events.map((event) => ({
      title: event.title ?? "Untitled event",
      outlook: event.outlook,
      confidence: event.confidence,
      reason: event.reason,
    })),
  }));
}

export function findAnalysisForEvent(analyses: Analysis[], eventId: string) {
  return analyses.find((analysis) => String(analysis.event_id) === String(eventId));
}

function eventPriority(event: Event, analysis?: Analysis): number {
  const riskScore = riskWeights[(analysis?.risk_level ?? "low").toLowerCase()] ?? 24;
  const importance = analysis?.importance_score ?? 0;
  const recency = event.published_at ? Math.max(0, 100 - Math.floor((Date.now() - new Date(event.published_at).getTime()) / 3_600_000)) : 0;
  return riskScore + Math.round(importance / 2) + recency;
}

function countBy(values: string[], limit: number): CountItem[] {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    const key = value || "Unclassified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function postureForScore(score: number, coverage: number): string {
  if (score >= 78 || coverage >= 85) return "Elevated";
  if (score >= 55) return "Guarded";
  return "Watch";
}

function dominantOutlook(impacts: MarketImpact[]): string {
  const score = impacts.reduce((total, impact) => {
    const outlook = impact.outlook.toLowerCase();
    if (outlook.includes("bullish") || outlook.includes("positive")) return total + 1;
    if (outlook.includes("bearish") || outlook.includes("negative")) return total - 1;
    return total;
  }, 0);

  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return impacts.length ? "mixed" : "neutral";
}

function isSupportive(impact: MarketImpact): boolean {
  const outlook = impact.outlook.toLowerCase();
  return outlook.includes("bullish") || outlook.includes("positive");
}

function isConflicting(impact: MarketImpact): boolean {
  const outlook = impact.outlook.toLowerCase();
  return outlook.includes("bearish") || outlook.includes("negative");
}

function assetMatches(value: string, asset: TrackedAsset): boolean {
  const norm = value.trim().toLowerCase();
  const canonical = ASSET_ALIASES[norm] ?? (norm.charAt(0).toUpperCase() + norm.slice(1));
  return canonical === asset;
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}