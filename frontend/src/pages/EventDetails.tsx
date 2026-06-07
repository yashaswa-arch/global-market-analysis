import { Link, useParams } from "react-router-dom";
import { Badge, toneForOutlook, toneForRisk } from "@/components/Badge";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/Status";
import { useEvent } from "@/hooks/useEvents";
import { formatDate, percent } from "@/utils/formatters";

export function EventDetails() {
  const { eventId = "" } = useParams();
  const eventQuery = useEvent(eventId);
  const event = eventQuery.data;
  const analysis = event?.analysis;

  return (
    <main className="details-page">
      <Link className="back-link" to="/dashboard">Back to intelligence dashboard</Link>
      {eventQuery.isLoading ? <LoadingBlock label="Loading event details..." /> : null}
      {eventQuery.isError ? <ErrorBlock message="Could not load event details." /> : null}
      {!eventQuery.isLoading && !event ? <EmptyBlock message="Event was not found in the latest backend data." /> : null}
      {event ? (
        <article className="details-layout">
          <header className="details-hero">
            <div className="details-badges">
              <Badge tone={toneForRisk(analysis?.risk_level)}>{analysis?.risk_level ?? "watch"}</Badge>
              <Badge tone="info">{analysis?.category ?? "Unclassified"}</Badge>
              <Badge tone="neutral">{event.source ?? "Unknown source"}</Badge>
            </div>
            <h1>{event.title}</h1>
            <p>{formatDate(event.published_at)}</p>
          </header>

          <section className="details-grid">
            <div className="details-panel">
              <h2>Confidence Scores</h2>
              <div className="score-stack">
                <span>Importance <strong>{percent(analysis?.importance_score)}</strong></span>
                <span>AI Confidence <strong>{percent(analysis?.confidence_score)}</strong></span>
                <span>Impact Type <strong>{analysis?.impact_type ?? "Unknown"}</strong></span>
                <span>Risk Level <strong>{analysis?.risk_level ?? "Unknown"}</strong></span>
              </div>
            </div>

            <div className="details-panel">
              <h2>Source Link</h2>
              <p>{event.description ?? "Source article and event metadata from the backend crisis feed."}</p>
              {event.url ? (
                <a className="source-button" href={event.url} target="_blank" rel="noreferrer">
                  Open source article
                </a>
              ) : (
                <p>No source URL available.</p>
              )}
            </div>
          </section>

          <section className="details-panel">
            <h2>Full Summary</h2>
            <p>{analysis?.summary ?? event.description ?? "No summary available yet."}</p>
          </section>

          <section className="details-panel">
            <h2>India Impact</h2>
            <p>{analysis?.impact_on_india ?? "No India-specific impact has been generated yet."}</p>
          </section>

          <section className="details-grid">
            <div className="details-panel">
              <h2>Affected Sectors</h2>
              <div className="tag-row">
                {(analysis?.affected_sectors?.length ? analysis.affected_sectors : ["Not identified"]).map((sector) => (
                  <Badge key={sector} tone="neutral">{sector}</Badge>
                ))}
              </div>
            </div>

            <div className="details-panel">
              <h2>Analyst Key Points</h2>
              {analysis?.key_points?.length ? (
                <ul className="analysis-points">
                  {analysis.key_points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : (
                <EmptyBlock message="No key points available yet." />
              )}
            </div>
          </section>

          <section className="details-panel">
            <h2>Market Impacts</h2>
            {analysis?.market_impacts?.length ? (
              <div className="market-impact-list">
                {analysis.market_impacts.map((impact) => (
                  <div className="market-impact" key={`${impact.asset}-${impact.outlook}`}>
                    <div>
                      <strong>{impact.asset}</strong>
                      <p>{impact.reason ?? "No rationale provided."}</p>
                    </div>
                    <Badge tone={toneForOutlook(impact.outlook)}>
                      {impact.outlook} | {percent(impact.confidence)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock message="No structured market impacts available." />
            )}
          </section>
        </article>
      ) : null}
    </main>
  );
}
