import { type CSSProperties, type ReactNode, useMemo } from "react";
import { Badge, toneForRisk } from "@/components/Badge";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/Status";
import { useAnalysis, useEvents, useUnanalyzedEvents } from "@/hooks/useEvents";
import { buildDashboardStats } from "@/lib/intelligence";
import { formatRelativeTime, percent } from "@/utils/formatters";

export function Dashboard() {
  const eventsQuery = useEvents({ limit: 60 });
  const analysisQuery = useAnalysis({ limit: 120 });
  const unanalyzedQuery = useUnanalyzedEvents({ limit: 1 });

  const events = eventsQuery.data?.events ?? [];
  const analyses = analysisQuery.data?.analysis ?? [];
  const stats = useMemo(
    () => buildDashboardStats(analyses, eventsQuery.data?.total ?? events.length, unanalyzedQuery.data?.total ?? 0),
    [analyses, events.length, eventsQuery.data?.total, unanalyzedQuery.data?.total],
  );
  const latestEvent = events[0];
  const latestAnalysis = analyses[0];

  return (
    <main className="intelligence-page dashboard-page">
      <section className="dashboard-topline">
        <div className="dashboard-hero compact-hero">
          <div className="hero-copy">
            <p className="eyebrow">Global intelligence dashboard</p>
            <h1>Operational view of risk, categories, and sector exposure.</h1>
            <div className="signal-strip">
              <Signal label="Feed Online" active={!eventsQuery.isError} />
              <Signal label="Analysis Pipeline" active={!analysisQuery.isError} />
              <Signal label="Coverage Sync" active={!unanalyzedQuery.isError} />
            </div>
          </div>
          <div className="risk-score-card hero-card">
            <div className="risk-score-ring" style={{ "--score": `${stats.globalRiskScore}%` } as CSSProperties}>
              <strong>{stats.globalRiskScore}</strong>
              <span>Global Risk</span>
            </div>
            <div className="risk-score-copy">
              <Badge tone={toneForRisk(stats.riskPosture === "Elevated" ? "critical" : stats.riskPosture === "Guarded" ? "high" : "low")}>{stats.riskPosture}</Badge>
              <p>
                {stats.criticalEvents} critical events, {stats.highRiskEvents} high-risk events, and {stats.totalAnalyses.toLocaleString()} analyses currently shape the risk stack.
              </p>
            </div>
          </div>
        </div>

        <section className="metric-grid">
          <Metric label="Total Events" value={stats.totalEvents} trend={latestEvent ? `Latest: ${latestEvent.title}` : "No feed data"} />
          <Metric label="Total Analyses" value={stats.totalAnalyses} trend={latestAnalysis ? `Most recent: ${latestAnalysis.category ?? "Unclassified"}` : "No analysis data"} />
          <Metric label="Critical Events" value={stats.criticalEvents} trend="Highest-priority alerts" />
          <Metric label="Global Risk Score" value={stats.globalRiskScore} trend={`${stats.riskPosture} posture`} />
        </section>
      </section>

      <section className="dashboard-grid">
        <Panel title="Top Risk Categories" subtitle="Current distribution of analysis categories">
          {stats.topRiskCategories.length ? (
            <div className="bar-list">
              {stats.topRiskCategories.map((item) => (
                <div className="bar-row" key={item.label}>
                  <span>{item.label}</span>
                  <div>
                    <i style={{ width: `${Math.max(8, Math.min(100, item.count * 12))}%` }} />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock message="No category data available yet." />
          )}
        </Panel>

        <Panel title="Sector Exposure Chart" subtitle="Most exposed sectors in the current intelligence set">
          {stats.sectorExposure.length ? (
            <div className="sector-exposure">
              <div className="donut donut--dashboard" style={{ background: exposureGradient(stats.sectorExposure) }}>
                <strong>{stats.sectorExposure.reduce((sum, item) => sum + item.count, 0)}</strong>
                <span>Signals</span>
              </div>
              <div className="distribution-legend">
                {stats.sectorExposure.map((item, index) => (
                  <div key={item.label}>
                    <i style={{ background: chartColor(index) }} />
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyBlock message="No sector exposure data available yet." />
          )}
        </Panel>
      </section>

      <section className="dashboard-grid dashboard-grid--single">
        <Panel title="Latest Intelligence Snapshot" subtitle="Most recent event and analysis context">
          {eventsQuery.isLoading || analysisQuery.isLoading ? <LoadingBlock /> : null}
          {eventsQuery.isError || analysisQuery.isError ? <ErrorBlock message="Unable to load the latest dashboard data." /> : null}
          {latestEvent ? (
            <div className="snapshot-card">
              <div className="snapshot-head">
                <Badge tone={toneForRisk(latestAnalysis?.risk_level)}>{latestAnalysis?.risk_level ?? "watch"}</Badge>
                <Badge tone="info">{latestAnalysis?.category ?? "Unclassified"}</Badge>
                <span>{latestEvent.source ?? "Unknown source"}</span>
                <span>{latestEvent.published_at ? formatRelativeTime(latestEvent.published_at) : "No date"}</span>
              </div>
              <h3>{latestEvent.title}</h3>
              <p>{latestAnalysis?.summary ?? latestEvent.description ?? "No summary available yet."}</p>
              <div className="snapshot-stats">
                <span>Importance <strong>{percent(latestAnalysis?.importance_score)}</strong></span>
                <span>Confidence <strong>{percent(latestAnalysis?.confidence_score)}</strong></span>
                <span>Risk <strong>{latestAnalysis?.risk_level ?? "Unknown"}</strong></span>
              </div>
            </div>
          ) : (
            <EmptyBlock message="No event data available for the dashboard snapshot." />
          )}
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="panel intelligence-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, trend }: { label: string; value: number; trend: string }) {
  return (
    <article className="metric intelligence-metric">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>{trend}</small>
    </article>
  );
}

function Signal({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={active ? "signal signal--active" : "signal signal--down"}>
      <i />
      {label}
    </span>
  );
}

function chartColor(index: number) {
  const colors = ["#28b7c4", "#35b88d", "#f7b955", "#ff6b6b", "#8fb3ff", "#a8d56f"];
  return colors[index % colors.length];
}

function exposureGradient(items: { label: string; count: number }[]) {
  const colors = ["#28b7c4", "#35b88d", "#f7b955", "#ff6b6b", "#8fb3ff", "#a8d56f"];
  const total = Math.max(items.reduce((sum, item) => sum + item.count, 0), 1);
  let cursor = 0;
  const slices = items.map((item, index) => {
    const start = (cursor / total) * 100;
    cursor += item.count;
    const end = (cursor / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  return `conic-gradient(${slices.join(", ")})`;
}
