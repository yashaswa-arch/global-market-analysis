import { Badge, toneForOutlook } from "@/components/Badge";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/Status";
import { useAnalysis } from "@/hooks/useEvents";
import { buildMarketIntelligenceCards } from "@/lib/intelligence";
import { percent } from "@/utils/formatters";

export function MarketIntelligence() {
  const analysisQuery = useAnalysis({ limit: 150 });
  const cards = buildMarketIntelligenceCards(analysisQuery.data?.analysis ?? []);

  return (
    <main className="intelligence-page">
      <section className="page-banner">
        <div>
          <p className="eyebrow">Market intelligence</p>
          <h1>Asset outlooks with supporting and conflicting signals.</h1>
          <p>Track how geopolitical and macro events are shaping crude oil, Nifty, USD/INR, and gold.</p>
        </div>
        <div className="banner-chip">{cards.length.toLocaleString()} assets monitored</div>
      </section>

      {analysisQuery.isLoading ? <LoadingBlock label="Loading market intelligence..." /> : null}
      {analysisQuery.isError ? <ErrorBlock message="Could not load market intelligence." /> : null}
      {!analysisQuery.isLoading && !cards.length ? <EmptyBlock message="No market outlook data available yet." /> : null}

      <section className="market-grid">
        {cards.map((card) => (
          <article className={`asset-card market-outlook-card asset-card--${outlookClass(card.overall_outlook)}`} key={card.asset}>
            <div className="asset-card__header">
              <div>
                <span className="asset-kicker">Market outlook</span>
                <h2>{card.asset}</h2>
              </div>
              <Badge tone={toneForOutlook(card.overall_outlook)}>{card.overall_outlook}</Badge>
            </div>
            <div className="confidence-bar" aria-label={`Confidence ${Math.round(card.weighted_confidence)} percent`}>
              <span style={{ width: `${Math.max(4, Math.min(100, card.weighted_confidence))}%` }} />
            </div>
            <div className="asset-stats">
              <span>Confidence <strong>{percent(card.weighted_confidence)}</strong></span>
              <span>Supporting <strong>{card.supporting_events.length}</strong></span>
              <span>Conflicting <strong>{card.conflicting_events.length}</strong></span>
            </div>
            <p>{card.reasoning}</p>

            <div className="signal-columns">
              <SignalColumn title="Supporting signals" items={card.supporting_events} emptyLabel="No bullish or positive signals recorded." />
              <SignalColumn title="Conflicting signals" items={card.conflicting_events} emptyLabel="No bearish or negative signals recorded." />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function SignalColumn({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: { title: string; outlook: string; confidence?: number; reason?: string }[];
  emptyLabel: string;
}) {
  return (
    <div className="signal-column">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={`${item.title}-${item.outlook}-${item.reason}`}>
              <strong>{item.title}</strong>
              <span>
                {item.outlook} | {percent(item.confidence)}
              </span>
              <p>{item.reason ?? "No rationale provided."}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyBlock message={emptyLabel} />
      )}
    </div>
  );
}

function outlookClass(outlook: string) {
  const normalized = outlook.toLowerCase();
  if (normalized.includes("bull")) return "up";
  if (normalized.includes("bear")) return "down";
  if (normalized.includes("mixed")) return "mixed";
  return "neutral";
}
