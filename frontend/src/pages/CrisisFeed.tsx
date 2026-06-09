import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Zap } from "lucide-react";
import { Badge, toneForRisk } from "@/components/Badge";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/Status";
import { useAnalysis, useEvents, useGenerateAnalysis } from "@/hooks/useEvents";
import { buildCrisisFeedRows } from "@/lib/intelligence";
import { formatRelativeTime, percent } from "@/utils/formatters";
import "./CrisisFeed.css";

export function CrisisFeed() {
  const navigate = useNavigate();
  const [rawSearch,      setRawSearch]      = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterPriority, setFilterPriority]  = useState("");
  const [filterRisk,     setFilterRisk]      = useState("");
  const [generating,     setGenerating]      = useState<Record<string, boolean>>({});

  // Debounce search input — 250ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(rawSearch), 250);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  const [displayLimit, setDisplayLimit] = useState(50);
  const eventsQuery    = useEvents({ 
    limit: displayLimit, 
    search: debouncedSearch,
    priority: filterPriority || undefined,
    risk_level: filterRisk || undefined,
  });
  const analysisQuery  = useAnalysis({ limit: 150 });
  const generateMutation = useGenerateAnalysis();

  const handleGenerate = useCallback(async (eventId: string) => {
    setGenerating(prev => ({ ...prev, [eventId]: true }));
    try {
      await generateMutation.mutateAsync(eventId);
      navigate(`/events/${eventId}`);
    } catch {
      // Card stays visible on error
    } finally {
      setGenerating(prev => ({ ...prev, [eventId]: false }));
    }
  }, [generateMutation, navigate]);

  const allRows = buildCrisisFeedRows(
    eventsQuery.data?.events ?? [],
    analysisQuery.data?.analysis ?? [],
  );

  const rows = allRows.filter(row => {
    if (!filterPriority && !filterRisk && !debouncedSearch && !row.analysis && (row.event.relevance_score ?? 0) < 70) return false;
    if (filterPriority) {
      const p = row.event.intelligence_priority || "MEDIUM";
      if (p !== filterPriority) return false;
    }
    if (filterRisk && row.analysis?.risk_level?.toLowerCase() !== filterRisk.toLowerCase()) return false;
    
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const matchEvent = 
        row.event.title?.toLowerCase().includes(q) ||
        row.event.description?.toLowerCase().includes(q) ||
        row.event.source?.toLowerCase().includes(q);
        
      const matchAnalysis = 
        row.analysis?.summary?.toLowerCase().includes(q) ||
        row.analysis?.countries_impacted?.some(c => c.toLowerCase().includes(q)) ||
        row.analysis?.market_impacts?.some(m => m.asset.toLowerCase().includes(q)) ||
        row.analysis?.category?.toLowerCase().includes(q);

      if (!matchEvent && !matchAnalysis) return false;
    }
    return true;
  });

  const critical = rows.filter(r => r.event.intelligence_priority === "CRITICAL");
  const high     = rows.filter(r => r.event.intelligence_priority === "HIGH");
  const medium   = rows.filter(r => r.event.intelligence_priority === "MEDIUM" || !r.event.intelligence_priority);
  const low      = rows.filter(r => r.event.intelligence_priority === "LOW");

  const isLoading  = eventsQuery.isLoading || analysisQuery.isLoading;
  const isError    = eventsQuery.isError   || analysisQuery.isError;
  const isSearching = rawSearch !== debouncedSearch;

  return (
    <main className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Intelligence Feed</h1>
          <p>
            {rows.length} event{rows.length !== 1 ? "s" : ""} · Ordered by relevance
            {isSearching && <span style={{ color: "var(--muted)", marginLeft: "6px" }}>— searching...</span>}
          </p>
        </div>
        <div className="feed-controls">
          <div className="search-wrap">
            <Search size={13} className="search-icon" />
            <input
              className="feed-search search-with-icon"
              type="search"
              placeholder="Search events, countries, assets, sectors..."
              value={rawSearch}
              onChange={e => setRawSearch(e.target.value)}
            />
          </div>
          <Filter size={13} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <select className="feed-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select className="feed-select" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
            <option value="">All Risks</option>
            <option value="critical">Critical Risk</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
      </div>

      {isLoading && <LoadingBlock label="Loading intelligence feed..." />}
      {isError   && <ErrorBlock  message="Could not load the intelligence feed." />}

      {!isLoading && rows.length === 0 && (
        <EmptyBlock message={debouncedSearch ? `No results for "${debouncedSearch}"` : "No intelligence events found."} />
      )}

      <AnimatePresence>
        {critical.length > 0 && (
          <FeedSection key="critical" title="Breaking Intelligence" icon={<Zap size={13} />} color="var(--text-1)" rows={critical} onGenerate={handleGenerate} generating={generating} />
        )}
        {high.length > 0 && (
          <FeedSection key="high" title="High Risk Events" icon={<Zap size={13} />} color="var(--text-1)" rows={high} onGenerate={handleGenerate} generating={generating} />
        )}
        {medium.length > 0 && (
          <FeedSection key="medium" title="Active Intelligence" icon={<Zap size={13} />} color="var(--text-1)" rows={medium} onGenerate={handleGenerate} generating={generating} />
        )}
        {low.length > 0 && (
          <FeedSection key="low" title="Standard Intel" icon={<Zap size={13} />} color="var(--muted)" rows={low} onGenerate={handleGenerate} generating={generating} />
        )}
      </AnimatePresence>

      {!isLoading && eventsQuery.data && (eventsQuery.data.events.length >= displayLimit) && (
        <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
          <button 
            className="btn btn-ghost" 
            onClick={() => setDisplayLimit(p => p + 50)}
            style={{ color: "var(--muted)" }}
          >
            LOAD MORE
          </button>
        </div>
      )}
    </main>
  );
}

type FeedRow = ReturnType<typeof buildCrisisFeedRows>[number];

function FeedSection({
  title, icon, color, rows, onGenerate, generating,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  rows: FeedRow[];
  onGenerate: (id: string) => void;
  generating: Record<string, boolean>;
}) {
  return (
    <motion.section
      className="feed-section"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="section-label" style={{ color }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          {icon} {title}
        </span>
        <span style={{ color: "var(--muted-2)", fontWeight: 400, fontSize: "0.58rem" }}>
          {rows.length} events
        </span>
      </div>
      <div className="feed-cards-grid">
        {rows.map(({ event, analysis }, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.3) }}
          >
            <FeedCard
              event={event}
              analysis={analysis}
              isGenerating={generating[event.id] ?? false}
              onGenerate={onGenerate}
            />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function FeedCard({
  event, analysis, isGenerating, onGenerate,
}: {
  event: FeedRow["event"];
  analysis: FeedRow["analysis"];
  isGenerating: boolean;
  onGenerate: (id: string) => void;
}) {
  const hasAnalysis = !!analysis;

  return (
    <article className="feed-card">
      <div className="feed-card-top">
        <div className="feed-card-badges">
          <span className={`priority-tag ${event.intelligence_priority?.toLowerCase() ?? "medium"}`}>
            {event.intelligence_priority ?? "MED"}
          </span>
          {hasAnalysis && (
            <Badge tone={toneForRisk(analysis!.risk_level)}>
              {analysis!.risk_level?.toUpperCase() ?? "RISK"}
            </Badge>
          )}
          {hasAnalysis && (
            <Badge tone="neutral">{percent(analysis!.confidence_score)} CONF</Badge>
          )}
          <Badge tone="info">{event.source_count ?? 1} SRC</Badge>
        </div>
        <span className="feed-card-time">{formatRelativeTime(event.published_at ?? "")}</span>
      </div>

      <div className="feed-card-body">
        <h2 className="feed-card-title">{event.title}</h2>
        <p className="feed-card-summary">
          {analysis?.summary ?? event.description ?? "Intelligence brief pending..."}
        </p>
      </div>

      <div className="feed-card-footer">
        <div className="feed-card-tags">
          {(analysis?.countries_impacted ?? []).slice(0, 3).map(c => (
            <Badge key={c} tone="neutral">{c}</Badge>
          ))}
          {(analysis?.market_impacts ?? []).slice(0, 2).map(m => (
            <Badge key={m.asset} tone="warning">{m.asset}</Badge>
          ))}
        </div>
        <div className="feed-card-actions">
          {hasAnalysis ? (
            <Link to={`/events/${event.id}`} className="btn btn-primary btn-sm">
              VIEW BRIEF →
            </Link>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              disabled={isGenerating}
              onClick={() => onGenerate(event.id)}
            >
              {isGenerating
                ? <><span className="spinner" /> GENERATING...</>
                : "GENERATE BRIEF"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
