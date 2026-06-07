import { Link } from "react-router-dom";
import { Badge, toneForRisk } from "@/components/Badge";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/Status";
import { useAnalysis, useEvents } from "@/hooks/useEvents";
import { buildCrisisFeedRows } from "@/lib/intelligence";
import { formatDate, formatRelativeTime, percent } from "@/utils/formatters";

export function CrisisFeed() {
  const eventsQuery = useEvents({ limit: 100 });
  const analysisQuery = useAnalysis({ limit: 120 });

  const rows = buildCrisisFeedRows(eventsQuery.data?.events ?? [], analysisQuery.data?.analysis ?? []).slice(0, 24);

  return (
    <main className="intelligence-page">
      <section className="page-banner">
        <div>
          <p className="eyebrow">Crisis feed</p>
          <h1>Prioritized event stream with importance, category, and source traceability.</h1>
          <p>Open any event for full analysis, source context, and impact details.</p>
        </div>
        <div className="banner-chip">{rows.length.toLocaleString()} events ranked</div>
      </section>

      {eventsQuery.isLoading || analysisQuery.isLoading ? <LoadingBlock label="Loading crisis feed..." /> : null}
      {eventsQuery.isError || analysisQuery.isError ? <ErrorBlock message="Could not load the crisis feed." /> : null}
      {!eventsQuery.isLoading && !rows.length ? <EmptyBlock message="No events are available yet." /> : null}

      <section className="feed-list">
        {rows.map(({ event, analysis }, index) => (
          <article className="feed-item" key={event.id}>
            <div className="feed-rank">#{index + 1}</div>
            <div className="feed-body">
              <div className="feed-meta">
                <Badge tone={toneForRisk(analysis?.risk_level)}>{analysis?.risk_level ?? "watch"}</Badge>
                <Badge tone="info">{analysis?.category ?? "Unclassified"}</Badge>
                <span>Importance {percent(analysis?.importance_score)}</span>
                <span>{event.source ?? "Unknown source"}</span>
              </div>
              <h2>{event.title}</h2>
              <p>{analysis?.summary ?? event.description ?? "No description available yet."}</p>
              <div className="feed-footer">
                <span>{event.published_at ? formatRelativeTime(event.published_at) : "No date"}</span>
                <span>{formatDate(event.published_at)}</span>
                <Link className="button button--secondary" to={`/events/${event.id}`}>
                  Open event details
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
