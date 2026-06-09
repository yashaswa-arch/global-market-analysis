import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, BarChart2, AlertTriangle, Clock, Globe } from "lucide-react";
import { Badge, toneForRisk } from "@/components/Badge";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/Status";
import { useAnalysis, useEvents, useSourceAnalytics } from "@/hooks/useEvents";
import { buildDashboardStats, buildCrisisFeedRows } from "@/lib/intelligence";
import { formatRelativeTime, percent } from "@/utils/formatters";
import { useQuery } from "@tanstack/react-query";
import { marketApi } from "@/api";
import { InteractiveWorldMap } from "@/components/InteractiveWorldMap";
import { GlobeMap } from "@/components/GlobeMap";
import { useTheme } from "@/providers/ThemeProvider";
import "./Dashboard.css";

const COUNTRY_COORDS: Record<string, [number, number]> = {
  "Russia": [100.0, 60.0], "Ukraine": [31.0, 48.0], "Israel": [34.8, 31.0],
  "Iran": [53.0, 32.0], "China": [104.0, 35.0], "Taiwan": [121.0, 23.5],
  "United States": [-95.0, 38.0], "India": [78.0, 21.0], "Pakistan": [69.0, 30.0],
  "United Kingdom": [-3.0, 55.0], "France": [2.0, 46.0], "Germany": [10.0, 51.0],
  "Japan": [138.0, 36.0], "North Korea": [127.0, 40.0], "South Korea": [127.0, 36.0],
  "Syria": [39.0, 35.0], "Lebanon": [35.8, 33.8], "Yemen": [47.0, 15.0],
  "Sudan": [30.0, 15.0], "Myanmar": [96.0, 21.0], "Afghanistan": [65.0, 33.0]
};

export function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  const eventsQuery    = useEvents({ limit: 100 });
  const analysisQuery  = useAnalysis({ limit: 150 });
  const analyticsQuery = useSourceAnalytics();
  const marketQuery    = useQuery({ queryKey: ["marketLive"], queryFn: () => marketApi.live(), refetchInterval: 60000 });
  const { theme } = useTheme();

  const events   = eventsQuery.data?.events   ?? [];
  const analyses = analysisQuery.data?.analysis ?? [];

  const stats = useMemo(
    () => buildDashboardStats(analyses, eventsQuery.data?.total ?? events.length, 0),
    [analyses, events.length, eventsQuery.data?.total],
  );

  const topThreats = useMemo(
    () => buildCrisisFeedRows(events, analyses)
      .filter(r => r.analysis)
      .slice(0, 10),
    [events, analyses],
  );

  const filteredThreats = useMemo(() => {
    if (!searchQuery.trim()) return topThreats;
    const q = searchQuery.toLowerCase();
    return topThreats.filter(r =>
      r.event.title?.toLowerCase().includes(q) ||
      (r.analysis?.summary ?? "").toLowerCase().includes(q) ||
      (r.analysis?.countries_impacted ?? []).some(c => c.toLowerCase().includes(q))
    );
  }, [topThreats, searchQuery]);

  const recentEvents = useMemo(() =>
    [...events]
      .filter(e => (e.relevance_score ?? 0) >= 50)
      .sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime())
      .slice(0, 8),
    [events],
  );

  const topCountries = useMemo(() => {
    const map: Record<string, number> = {};
    analyses.forEach(a => (a.countries_impacted ?? []).forEach(c => { map[c] = (map[c] ?? 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [analyses]);

  const topAssets = useMemo(() => {
    const map: Record<string, number> = {};
    analyses.forEach(a => (a.market_impacts ?? []).forEach(m => { map[m.asset] = (map[m.asset] ?? 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [analyses]);

  const dynamicHotspots = useMemo(() => {
    return topCountries.map(([name, count]) => {
      const coords = COUNTRY_COORDS[name] || [0, 0];
      const risk = count > 10 ? "critical" : count > 5 ? "high" : "medium";
      return { name, coordinates: coords as [number, number], cobeSize: count > 10 ? 0.1 : count > 5 ? 0.07 : 0.04, risk, detail: `${count} active events` };
    }).filter(h => h.coordinates[0] !== 0);
  }, [topCountries]);

  const indiaEvents = useMemo(() =>
    [...events]
      .filter(e => (e.title?.toLowerCase().includes("india")) || (e.description && e.description.toLowerCase().includes("india")))
      .sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime())
      .slice(0, 5),
    [events]
  );

  const marketDataList = (marketQuery.data?.data || []) as any[];
  const nifty = marketDataList.find((m: any) => m.asset === "NIFTY 50");
  const gold = marketDataList.find((m: any) => m.asset === "Gold");

  const ribbonEvents = useMemo(() =>
    events.filter(e => (e.relevance_score ?? 0) >= 70).slice(0, 10),
    [events],
  );

  const isLoading = eventsQuery.isLoading || analysisQuery.isLoading;
  const isError   = eventsQuery.isError   || analysisQuery.isError;

  return (
    <main className="dash-page">
      {/* Ribbon */}
      <div className="intel-ribbon premium-ribbon">
        <div className="intel-ribbon-label">
          <span className="ribbon-pulse" />
          LIVE INTEL
        </div>
        <div className="intel-ribbon-track">
          <div className="intel-ribbon-inner">
            {[...ribbonEvents, ...ribbonEvents].map((e, i) => (
              <span key={i} className="ribbon-item">
                <span className={`priority-tag ${e.intelligence_priority?.toLowerCase() ?? "medium"}`}>
                  {e.intelligence_priority ?? "MED"}
                </span>
                <span className="ribbon-text">{e.title}</span>
                <span className="ribbon-time">{formatRelativeTime(e.published_at ?? "")}</span>
                <span className="ribbon-sep"><TrendingUp size={10} /></span>
              </span>
            ))}
            {ribbonEvents.length === 0 && (
              <span className="ribbon-item" style={{ color: "var(--muted)" }}>Monitoring global intelligence streams...</span>
            )}
          </div>
        </div>
      </div>

      <div className="page">
        {/* Header */}
        <div className="dash-header">
          <div className="dash-header-left">
            <h1>Geopolitical Operations Center</h1>
            <p>Global risk surveillance · {new Date().toUTCString().slice(0, 25)} UTC</p>
          </div>
          <div className="metric-strip">
            <MetricInline label="CRITICAL" value={stats.criticalEvents} tone={stats.criticalEvents > 0 ? "critical" : "good"} />
            <div className="metric-divider" />
            <MetricInline label="HIGH RISK" value={stats.highRiskEvents} tone="high" />
            <div className="metric-divider" />
            <MetricInline label="ANALYSED" value={analyses.length} tone="accent" />
            <div className="metric-divider" />
            <MetricInline label="RISK INDEX" value={stats.globalRiskScore} tone={stats.globalRiskScore > 70 ? "critical" : stats.globalRiskScore > 50 ? "high" : "accent"} />
            <div className="metric-divider" />
            <MetricInline label="HQ CLUSTERS" value={analyticsQuery.data?.high_confidence_clusters ?? 0} tone="accent" />
          </div>
        </div>

        {isLoading && <LoadingBlock label="Loading intelligence..." />}
        {isError   && <ErrorBlock  message="Could not connect to intelligence feed." />}

        <div className="dash-grid">
          {/* Main column */}
          <div className="dash-main">
            {/* Threat table */}
            <div className="panel">
              <div className="panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertTriangle size={13} color="var(--high)" />
                  <h2>Top Global Threats</h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    className="dash-search"
                    type="search"
                    placeholder="Filter threats..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <span className="panel-meta">{filteredThreats.length} events</span>
                </div>
              </div>
              <div style={{ padding: 0 }}>
                {filteredThreats.length === 0 && !isLoading ? (
                  <div style={{ padding: "14px" }}>
                    <EmptyBlock message="No analyzed threats found. Run analysis to populate." />
                  </div>
                ) : (
                  <table className="intel-table">
                    <thead>
                      <tr>
                        <th>Score</th>
                        <th>Priority</th>
                        <th>Risk</th>
                        <th>Conf</th>
                        <th style={{ minWidth: "280px" }}>Event</th>
                        <th>Countries</th>
                        <th>Updated</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredThreats.map(({ event, analysis }, i) => (
                        <motion.tr
                          key={event.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <td className="score-cell">{event.relevance_score ?? 0}</td>
                          <td>
                            <span className={`priority-tag ${event.intelligence_priority?.toLowerCase() ?? "medium"}`}>
                              {event.intelligence_priority ?? "MED"}
                            </span>
                          </td>
                          <td>
                            <Badge tone={toneForRisk(analysis?.risk_level)}>
                              {analysis?.risk_level?.toUpperCase() ?? "—"}
                            </Badge>
                          </td>
                          <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem", color: "var(--accent)" }}>
                            {percent(analysis?.confidence_score)}
                          </td>
                          <td className="title-cell">{event.title}</td>
                          <td>
                            <div className="tag-row">
                              {(analysis?.countries_impacted ?? []).slice(0, 2).map(c => (
                                <Badge key={c} tone="info">{c}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="date-cell">{formatRelativeTime(event.published_at ?? "")}</td>
                          <td>
                            <Link to={`/events/${event.id}`} className="view-link">BRIEF →</Link>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Risk Map */}
            <div className="panel risk-map-panel" style={{ height: "400px" }}>
              <div className="panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <TrendingUp size={13} color="var(--accent)" />
                  <h2>Global Risk Map</h2>
                </div>
                <span className="panel-meta">Active hotspots · Zoom, pan & click</span>
              </div>
              <div style={{ position: "relative", width: "100%", height: "calc(100% - 40px)", overflow: "hidden" }}>
                <InteractiveWorldMap 
                  hotspots={dynamicHotspots.map(h => ({ name: h.name, coordinates: h.coordinates, risk: h.risk, detail: h.detail, count: h.cobeSize * 100 }))} 
                  onCountryClick={(country) => setSearchQuery(country)}
                />
                <div className="map-legend" style={{ position: "absolute", bottom: "10px", right: "10px", display: "flex", gap: "10px", fontSize: "0.7rem" }}>
                  <span className="map-legend-item critical" style={{ color: "var(--critical)" }}>● CRITICAL</span>
                  <span className="map-legend-item high" style={{ color: "var(--high)" }}>● HIGH</span>
                  <span className="map-legend-item medium" style={{ color: "var(--medium)" }}>● ELEVATED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="dash-sidebar">
            
            {/* Revolving Globe (Dashboard Header/Sidebar Feature) */}
            <div className="panel" style={{ height: "260px", padding: 0, overflow: "hidden", position: "relative", border: "1px solid var(--line)", background: "var(--surface-1)", marginBottom: "16px" }}>
              <div style={{ position: "absolute", top: "12px", left: "14px", zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Globe size={12} color="var(--accent)" />
                  <h2 style={{ fontSize: "0.65rem", margin: 0, color: "var(--text)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Global Threat Intel</h2>
                </div>
              </div>
              <div style={{ width: "100%", height: "100%", position: "absolute", top: "10px" }}>
                <GlobeMap 
                  theme={theme === "light" ? "light" : "dark"}
                  markers={dynamicHotspots.map(h => ({ 
                    location: h.coordinates, 
                    size: h.cobeSize, 
                    color: h.risk === "critical" ? [0.86, 0.2, 0.27] : h.risk === "high" ? [0.87, 0.48, 0.2] : [0.78, 0.63, 0.15] 
                  }))} 
                />
              </div>
            </div>

            {/* Live Markets (NIFTY & GOLD) */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              {[nifty, gold].map((asset, idx) => asset && (
                <div key={idx} style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: "6px", padding: "12px", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: "0.65rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>
                    {asset.asset.toUpperCase()}
                  </div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", color: "var(--text)" }}>
                    {asset.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "---"}
                  </div>
                  <div style={{ fontSize: "0.75rem", fontFamily: "'JetBrains Mono', monospace", color: (asset.daily_change ?? 0) >= 0 ? "var(--good)" : "var(--critical)", marginTop: "2px", fontWeight: 600 }}>
                    {(asset.daily_change ?? 0) >= 0 ? "+" : ""}{asset.daily_change ? asset.daily_change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"} ({(asset.daily_change ?? 0) >= 0 ? "+" : ""}{asset.daily_percent ? asset.daily_percent.toFixed(2) : "0.00"}%)
                  </div>
                </div>
              ))}
            </div>

            {/* India Crucial Events */}
            <div className="panel">
              <div className="panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <AlertTriangle size={12} color="var(--critical)" />
                  <h2>India Crucial Events</h2>
                </div>
              </div>
              <div className="latest-feed">
                {indiaEvents.map((e, i) => (
                  <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                    <Link to={`/events/${e.id}`} className="latest-item">
                      <div className="latest-item-top">
                        <span className={`priority-tag ${e.intelligence_priority?.toLowerCase() ?? "medium"}`}>
                          {e.intelligence_priority ?? "MED"}
                        </span>
                        <span className="latest-time">{formatRelativeTime(e.published_at ?? "")}</span>
                      </div>
                      <span className="latest-title">{e.title}</span>
                    </Link>
                  </motion.div>
                ))}
                {indiaEvents.length === 0 && !isLoading && (
                  <div style={{ padding: "12px 14px" }}><EmptyBlock message="No active India events." /></div>
                )}
              </div>
            </div>
            {/* Latest Intel */}
            <div className="panel">
              <div className="panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <Clock size={12} color="var(--accent)" />
                  <h2>Latest Intelligence</h2>
                </div>
                <Link to="/crisis-feed" className="view-link" style={{ fontSize: "0.62rem" }}>ALL →</Link>
              </div>
              <div className="latest-feed">
                {recentEvents.map((e, i) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link to={`/events/${e.id}`} className="latest-item">
                      <div className="latest-item-top">
                        <span className={`priority-tag ${e.intelligence_priority?.toLowerCase() ?? "medium"}`}>
                          {e.intelligence_priority ?? "MED"}
                        </span>
                        <span className="latest-time">{formatRelativeTime(e.published_at ?? "")}</span>
                      </div>
                      <span className="latest-title">{e.title}</span>
                    </Link>
                  </motion.div>
                ))}
                {recentEvents.length === 0 && !isLoading && (
                  <div style={{ padding: "12px 14px" }}><EmptyBlock message="No recent events." /></div>
                )}
              </div>
            </div>

            {/* Countries */}
            <div className="panel">
              <div className="panel-header">
                <h2>Countries at Risk</h2>
              </div>
              <div className="panel-body">
                {topCountries.length ? (
                  <div className="impact-list">
                    {topCountries.map(([country, count], i) => (
                      <div key={country} className="impact-row">
                        <span className="impact-rank">#{i + 1}</span>
                        <span className="impact-label">{country}</span>
                        <div className="impact-bar-wrap">
                          <div className="impact-bar" style={{ width: `${Math.min(100, (count / (topCountries[0]?.[1] ?? 1)) * 100)}%` }} />
                        </div>
                        <span className="impact-count">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock message="Analyzing countries..." />
                )}
              </div>
            </div>

            {/* Assets */}
            <div className="panel">
              <div className="panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <BarChart2 size={12} color="var(--accent)" />
                  <h2>Asset Exposure</h2>
                </div>
                <Link to="/market-intelligence" className="view-link" style={{ fontSize: "0.62rem" }}>DETAIL →</Link>
              </div>
              <div className="panel-body">
                {topAssets.length ? (
                  <div className="impact-list">
                    {topAssets.map(([asset, count], i) => (
                      <div key={asset} className="impact-row">
                        <span className="impact-rank">#{i + 1}</span>
                        <span className="impact-label">{asset}</span>
                        <div className="impact-bar-wrap">
                          <div className="impact-bar accent-bar" style={{ width: `${Math.min(100, (count / (topAssets[0]?.[1] ?? 1)) * 100)}%` }} />
                        </div>
                        <span className="impact-count">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock message="Analyzing assets..." />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function MetricInline({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="metric-inline">
      <span className="metric-inline-label">{label}</span>
      <motion.span
        className={`metric-inline-value ${tone ?? ""}`}
        key={value}
        initial={{ opacity: 0.5, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        {value}
      </motion.span>
    </div>
  );
}
