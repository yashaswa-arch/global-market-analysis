import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import {
  Activity, Globe, TrendingUp, BarChart2, BotMessageSquare,
  ShieldCheck, Zap, ArrowRight, Check, Radio, ChevronRight
} from "lucide-react";
import { GlobeMap } from "@/components/GlobeMap";
import { useTheme } from "@/providers/ThemeProvider";
import "./Landing.css";

export function Landing() {
  const { userId } = useAuthStore();
  const { theme } = useTheme();

  // Authenticated User: CTA buttons will reflect auth state.

  return (
    <div className="lp">

      {/* ── Navbar ── */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-brand">
            <div className="lp-brand-icon">
              <Activity size={16} strokeWidth={2.5} />
            </div>
            <span>GLOBINTEL</span>
          </Link>

          <nav className="lp-links">
            <a href="#features" className="lp-link">Features</a>
            <a href="#intelligence" className="lp-link">Intelligence</a>
            <a href="#analytics" className="lp-link">Analytics</a>
            <a href="#ai" className="lp-link">AI Analyst</a>
          </nav>

          <div className="lp-nav-cta">
            {userId ? (
              <Link to="/dashboard" className="lp-nav-signup">
                Go to Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="lp-nav-login">Log In</Link>
                <Link to="/signup" className="lp-nav-signup">
                  Get Started <ChevronRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero-glow lp-hero-glow--1" />
        <div className="lp-hero-glow lp-hero-glow--2" />

        <div className="lp-hero-inner">
          <div className="lp-hero-badge">
            <span className="lp-live-dot" />
            Live Intelligence Platform · 40+ Global Sources
          </div>

          <h1 className="lp-hero-title">
            Navigate Global Markets<br />
            <span className="lp-hero-accent">with AI Precision</span>
          </h1>

          <p className="lp-hero-subtitle">
            GlobIntel fuses geopolitical signals, real-time market data, and
            institutional-grade AI analysis into a single command center — built
            for professionals who demand an absolute edge.
          </p>

          <div className="lp-hero-cta">
            {userId ? (
              <Link to="/dashboard" className="lp-btn-primary">
                Open Dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link to="/signup" className="lp-btn-primary">
                  Start Free Trial <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="lp-btn-ghost">
                  Sign In to Dashboard
                </Link>
              </>
            )}
          </div>

          <div className="lp-hero-stats">
            <StatPill value="40+" label="Intel Sources" />
            <div className="lp-stat-sep" />
            <StatPill value="Real-Time" label="Market Data" />
            <div className="lp-stat-sep" />
            <StatPill value="AI-Powered" label="Analysis" />
            <div className="lp-stat-sep" />
            <StatPill value="24/7" label="Monitoring" />
          </div>
        </div>

        {/* Immersive 3D Globe */}
        <div className="lp-hero-mockup lp-hero-globe">
          <div className="lp-mockup-frame" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <div style={{ position: 'relative', width: '100%', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', background: theme === 'dark' ? 'radial-gradient(circle, rgba(200,168,75,0.15) 0%, transparent 60%)' : 'radial-gradient(circle, rgba(200,168,75,0.2) 0%, transparent 60%)', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }} />
              <div style={{ zIndex: 1, width: '100%', maxWidth: '600px', aspectRatio: '1/1' }}>
                <GlobeMap theme={theme === "light" ? "light" : "dark"} markers={[
                  { location: [31.0, 48.0], size: 0.1, color: [0.86, 0.2, 0.27] }, // Ukraine
                  { location: [34.8, 31.0], size: 0.1, color: [0.86, 0.2, 0.27] }, // Israel
                  { location: [121.0, 23.5], size: 0.08, color: [0.87, 0.48, 0.2] }, // Taiwan
                  { location: [53.0, 32.0], size: 0.08, color: [0.87, 0.48, 0.2] }, // Iran
                  { location: [47.0, 15.0], size: 0.05, color: [0.78, 0.63, 0.15] } // Yemen
                ]} />
              </div>
              <div style={{ position: 'absolute', top: '40px', left: '10%', zIndex: 2, transform: 'scale(0.9)' }}>
                <MockMetric label="CRITICAL ZONES" value="3" color="red" />
              </div>
              <div style={{ position: 'absolute', bottom: '60px', right: '10%', zIndex: 2, transform: 'scale(0.9)' }}>
                <MockMetric label="HIGH RISK" value="14" color="orange" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trusted by banner ── */}
      <div className="lp-trust-bar">
        <span className="lp-trust-label">Trusted by analysts at</span>
        <div className="lp-trust-logos">
          {["Goldman Sachs", "BlackRock", "Bridgewater", "JP Morgan", "Citadel", "Two Sigma"].map(n => (
            <span key={n} className="lp-trust-name">{n}</span>
          ))}
        </div>
      </div>

      {/* ── Data Visualization Section ── */}
      <section className="lp-section lp-section--dark" id="globe">
        <div className="lp-section-inner" style={{ display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div className="lp-section-label lp-section-label--left">GLOBAL SURVEILLANCE</div>
            <h2 className="lp-section-title lp-section-title--left">Real-time threat visualization</h2>
            <p className="lp-section-sub lp-section-sub--left">
              Track geopolitical shifts, armed conflicts, and economic disruptions as they unfold. Our real-time data feeds map breaking intelligence directly to its global impact.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <div style={{ background: "rgba(220,53,69,0.1)", padding: "10px 16px", borderRadius: "8px", border: "1px solid rgba(220,53,69,0.2)" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ff6b6b", fontFamily: "'JetBrains Mono', monospace" }}>14</div>
                <div style={{ fontSize: "0.7rem", color: "rgba(232,234,237,0.5)", textTransform: "uppercase", fontWeight: 600 }}>Critical Zones</div>
              </div>
              <div style={{ background: "rgba(224,123,53,0.1)", padding: "10px 16px", borderRadius: "8px", border: "1px solid rgba(224,123,53,0.2)" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f0965a", fontFamily: "'JetBrains Mono', monospace" }}>42</div>
                <div style={{ fontSize: "0.7rem", color: "rgba(232,234,237,0.5)", textTransform: "uppercase", fontWeight: 600 }}>Elevated Risk</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '300px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
            {/* Dashboard Mockup Moved Here */}
            <div className="lp-mockup-frame" style={{ width: '100%' }}>
              <div className="lp-mockup-bar">
                <span className="lp-dot lp-dot--red" />
                <span className="lp-dot lp-dot--yellow" />
                <span className="lp-dot lp-dot--green" />
                <span className="lp-mockup-url">globintel.io/dashboard</span>
              </div>
              <div className="lp-mockup-body">
                {/* Ribbon */}
                <div className="lp-mock-ribbon">
                  <span className="lp-mock-ribbon-tag">CRITICAL</span>
                  <span className="lp-mock-ribbon-text">Fed holds rates — markets stabilize · OPEC+ cuts production by 1M bpd · Taiwan Strait tensions escalate ·</span>
                </div>
                {/* Metric row */}
                <div className="lp-mock-metrics">
                  <MockMetric label="CRITICAL" value="3" color="red" />
                  <MockMetric label="HIGH RISK" value="14" color="orange" />
                  <MockMetric label="ANALYSED" value="241" color="gold" />
                  <MockMetric label="RISK INDEX" value="68" color="orange" />
                </div>
                {/* Table rows */}
                <div className="lp-mock-table">
                  <MockRow score="94" priority="CRITICAL" title="Federal Reserve Emergency Rate Decision" countries="US, EU" color="red" />
                  <MockRow score="87" priority="HIGH" title="OPEC+ Emergency Production Cut Agreement" countries="SA, RU, UAE" color="orange" />
                  <MockRow score="81" priority="HIGH" title="Taiwan Strait Naval Exercises Escalation" countries="TW, CN, US" color="orange" />
                  <MockRow score="74" priority="MED" title="European Energy Grid Disruption Risk" countries="DE, FR, PL" color="gold" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section" id="features">
        <div className="lp-section-inner">
          <div className="lp-section-label">PLATFORM CAPABILITIES</div>
          <h2 className="lp-section-title">Everything you need to<br />dominate the market</h2>
          <p className="lp-section-sub">
            A complete intelligence suite designed for professional traders, analysts, and risk managers.
          </p>

          <div className="lp-features-grid">
            <FeatureCard
              icon={<Radio size={22} />}
              title="Live Intel Feed"
              desc="Real-time aggregation from 40+ global news, wire, and government sources — scored for market relevance and geopolitical impact."
              items={["Relevance scoring", "Priority classification", "Source credibility rating"]}
              color="red"
            />
            <FeatureCard
              icon={<TrendingUp size={22} />}
              title="Asset Intelligence"
              desc="Track global indices, commodities, currencies, and digital assets with institutional-grade data and event correlation."
              items={["Live price feeds", "Event impact mapping", "Cross-asset correlation"]}
              color="gold"
            />
            <FeatureCard
              icon={<BarChart2 size={22} />}
              title="Source Analytics"
              desc="Evaluate the credibility, bias, and historical accuracy of intelligence sources with automated quality scoring."
              items={["Bias detection", "Reliability trends", "Source coverage map"]}
              color="blue"
            />
            <FeatureCard
              icon={<BotMessageSquare size={22} />}
              title="AI Analyst"
              desc="Interact with our advanced AI to query events, generate executive briefings, and receive strategic market analysis."
              items={["Natural language queries", "Executive summaries", "Market impact forecasting"]}
              color="green"
            />
            <FeatureCard
              icon={<Globe size={22} />}
              title="Global Risk Map"
              desc="Visualize geopolitical hotspots in real time — see exactly which regions are driving market volatility."
              items={["Hotspot heat map", "Country risk index", "Event clustering"]}
              color="orange"
            />
            <FeatureCard
              icon={<ShieldCheck size={22} />}
              title="Consensus Engine"
              desc="AI consensus clustering identifies when multiple sources confirm the same event — boosting your signal confidence."
              items={["Multi-source verification", "Confidence scoring", "Cluster detection"]}
              color="purple"
            />
          </div>
        </div>
      </section>

      {/* ── Market Intelligence Showcase ── */}
      <section className="lp-section lp-section--dark" id="intelligence">
        <div className="lp-section-inner lp-showcase-grid">
          <div className="lp-showcase-text">
            <div className="lp-section-label">MARKET INTELLIGENCE</div>
            <h2 className="lp-section-title lp-section-title--left">
              Real-time signals,<br />zero noise
            </h2>
            <p className="lp-section-sub lp-section-sub--left">
              Our proprietary relevance engine filters out lifestyle and entertainment noise,
              keeping your feed laser-focused on macroeconomic events that move markets.
            </p>
            <ul className="lp-check-list">
              {[
                "Geopolitical event scoring with 94% accuracy",
                "Automated market impact classification",
                "Cross-market ripple effect detection",
                "Historical pattern matching for new events",
                "Instant alerts for critical risk thresholds",
              ].map(item => (
                <li key={item} className="lp-check-item">
                  <Check size={15} className="lp-check-icon" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/signup" className="lp-btn-primary lp-btn-primary--sm">
              See It Live <ArrowRight size={14} />
            </Link>
          </div>

          <div className="lp-showcase-visual">
            <div className="lp-showcase-card">
              <div className="lp-showcase-card-header">
                <Radio size={14} />
                <span>Live Intel Feed</span>
                <span className="lp-live-badge">LIVE</span>
              </div>
              {[
                { score: 94, priority: "CRITICAL", title: "Federal Reserve Signals Pivot Ahead of Schedule", time: "2m ago", color: "red" },
                { score: 87, priority: "HIGH", title: "OPEC+ Surprises with 1.2M BPD Production Cut", time: "14m ago", color: "orange" },
                { score: 81, priority: "HIGH", title: "Taiwan Strait: PLA Conducts Live-Fire Exercises", time: "31m ago", color: "orange" },
                { score: 74, priority: "MED", title: "ECB Vice President Warns of Stagflation Risk", time: "1h ago", color: "gold" },
                { score: 68, priority: "MED", title: "US Treasury 10Y Yield Breaks Critical Resistance", time: "2h ago", color: "gold" },
              ].map((item, i) => (
                <div key={i} className="lp-feed-row">
                  <span className={`lp-score lp-score--${item.color}`}>{item.score}</span>
                  <div className="lp-feed-row-content">
                    <span className={`lp-priority lp-priority--${item.color}`}>{item.priority}</span>
                    <span className="lp-feed-title">{item.title}</span>
                  </div>
                  <span className="lp-feed-time">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Analytics Showcase ── */}
      <section className="lp-section" id="analytics">
        <div className="lp-section-inner lp-showcase-grid lp-showcase-grid--reverse">
          <div className="lp-showcase-visual">
            <div className="lp-showcase-card">
              <div className="lp-showcase-card-header">
                <BarChart2 size={14} />
                <span>Source Analytics</span>
              </div>
              <div className="lp-analytics-mock">
                {[
                  { name: "Reuters", score: 94, events: 1240 },
                  { name: "Bloomberg", score: 91, events: 980 },
                  { name: "AP Wire", score: 88, events: 1102 },
                  { name: "MarketAux", score: 83, events: 654 },
                  { name: "Financial Times", score: 79, events: 421 },
                ].map((s, i) => (
                  <div key={i} className="lp-analytics-row">
                    <span className="lp-analytics-rank">{i + 1}</span>
                    <span className="lp-analytics-name">{s.name}</span>
                    <div className="lp-analytics-bar-wrap">
                      <div className="lp-analytics-bar" style={{ width: `${s.score}%` }} />
                    </div>
                    <span className="lp-analytics-score">{s.score}</span>
                  </div>
                ))}
              </div>
              <div className="lp-analytics-footer">
                <span>1,240 sources monitored</span>
                <span>Updated hourly</span>
              </div>
            </div>
          </div>

          <div className="lp-showcase-text">
            <div className="lp-section-label">SOURCE ANALYTICS</div>
            <h2 className="lp-section-title lp-section-title--left">
              Know your sources,<br />trust your data
            </h2>
            <p className="lp-section-sub lp-section-sub--left">
              Not all sources are equal. GlobIntel automatically scores every intelligence source
              for credibility, bias, and historical accuracy — so you always know who to trust.
            </p>
            <ul className="lp-check-list">
              {[
                "Automated bias and credibility scoring",
                "Historical accuracy tracking per source",
                "Coverage gap detection across regions",
                "Publisher reliability trend analysis",
              ].map(item => (
                <li key={item} className="lp-check-item">
                  <Check size={15} className="lp-check-icon" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/signup" className="lp-btn-primary lp-btn-primary--sm">
              Explore Analytics <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── AI Showcase ── */}
      <section className="lp-section lp-section--dark" id="ai">
        <div className="lp-section-inner lp-showcase-grid">
          <div className="lp-showcase-text">
            <div className="lp-section-label">AI ANALYST</div>
            <h2 className="lp-section-title lp-section-title--left">
              Your institutional<br />AI strategist
            </h2>
            <p className="lp-section-sub lp-section-sub--left">
              Ask anything. The GlobIntel AI Analyst is trained on live market data and geopolitical
              events — delivering executive-grade insights on demand, in seconds.
            </p>
            <ul className="lp-check-list">
              {[
                "Natural language market queries",
                "Executive briefing generation",
                "Event impact chain analysis",
                "Portfolio risk narrative summaries",
              ].map(item => (
                <li key={item} className="lp-check-item">
                  <Check size={15} className="lp-check-icon" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/signup" className="lp-btn-primary lp-btn-primary--sm">
              Try AI Analyst <ArrowRight size={14} />
            </Link>
          </div>

          <div className="lp-showcase-visual">
            <div className="lp-showcase-card lp-chat-card">
              <div className="lp-showcase-card-header">
                <BotMessageSquare size={14} />
                <span>AI Analyst</span>
                <span className="lp-live-badge lp-live-badge--green">ONLINE</span>
              </div>
              <div className="lp-chat-body">
                <div className="lp-chat-msg lp-chat-msg--user">
                  What's the market impact of the OPEC+ production cut today?
                </div>
                <div className="lp-chat-msg lp-chat-msg--ai">
                  <div className="lp-chat-ai-label">
                    <Zap size={11} /> GLOBINTEL AI
                  </div>
                  <p>The OPEC+ cut of 1.2M BPD is likely to push <strong>Brent Crude above $92/barrel</strong> within 48h. Key exposures:</p>
                  <ul className="lp-chat-list">
                    <li>Energy equities (XLE, BP, Shell) — <span className="lp-green">Bullish</span></li>
                    <li>Airlines, Shipping (DAL, FDX) — <span className="lp-red">Bearish</span></li>
                    <li>USD/petrocurrency pairs — watch NOK, CAD strength</li>
                  </ul>
                  <p className="lp-chat-confidence">Confidence: <strong>87%</strong> · Sources: 14</p>
                </div>
                <div className="lp-chat-input-mock">
                  <span>Ask a market question...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing / CTA ── */}
      <section className="lp-cta-section">
        <div className="lp-cta-glow" />
        <div className="lp-cta-inner">
          <div className="lp-section-label lp-section-label--center">GET STARTED TODAY</div>
          <h2 className="lp-cta-title">
            The intelligence edge<br />professionals rely on
          </h2>
          <p className="lp-cta-sub">
            Join thousands of analysts, traders, and risk managers who use GlobIntel
            to stay ahead of every market-moving event.
          </p>
          <div className="lp-cta-btns">
            <Link to="/signup" className="lp-btn-primary lp-btn-primary--lg">
              Start Free Trial <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="lp-btn-outline">
              Already have an account? Sign In
            </Link>
          </div>
          <p className="lp-cta-note">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-brand-icon lp-brand-icon--sm">
              <Activity size={13} strokeWidth={2.5} />
            </div>
            <span className="lp-footer-name">GLOBINTEL</span>
            <span className="lp-footer-copy">© 2026 GlobIntel Platform</span>
          </div>
          <div className="lp-footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Security</a>
            <a href="#">Contact</a>
          </div>
          <div className="lp-footer-status">
            <span className="lp-live-dot" />
            All systems operational
          </div>
        </div>
      </footer>

    </div>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="lp-stat-pill">
      <span className="lp-stat-value">{value}</span>
      <span className="lp-stat-label">{label}</span>
    </div>
  );
}

function FeatureCard({ icon, title, desc, items, color }: {
  icon: React.ReactNode; title: string; desc: string; items: string[]; color: string;
}) {
  return (
    <div className={`lp-feat-card lp-feat-card--${color}`}>
      <div className={`lp-feat-icon lp-feat-icon--${color}`}>{icon}</div>
      <h3 className="lp-feat-title">{title}</h3>
      <p className="lp-feat-desc">{desc}</p>
      <ul className="lp-feat-items">
        {items.map(item => (
          <li key={item} className="lp-feat-item">
            <Check size={12} className="lp-feat-check" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MockMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="lp-mock-metric">
      <span className="lp-mock-metric-label">{label}</span>
      <span className={`lp-mock-metric-value lp-mock-metric-value--${color}`}>{value}</span>
    </div>
  );
}

function MockRow({ score, priority, title, countries, color }: {
  score: string; priority: string; title: string; countries: string; color: string;
}) {
  return (
    <div className="lp-mock-row">
      <span className={`lp-mock-score lp-mock-score--${color}`}>{score}</span>
      <span className={`lp-mock-priority lp-mock-priority--${color}`}>{priority}</span>
      <span className="lp-mock-title">{title}</span>
      <span className="lp-mock-countries">{countries}</span>
    </div>
  );
}
