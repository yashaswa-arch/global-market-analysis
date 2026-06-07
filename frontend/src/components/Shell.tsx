import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">GI</span>
          <span>
            <strong>Global Intelligence</strong>
            <small>Geopolitical and market surveillance</small>
          </span>
        </Link>
        <nav className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/crisis-feed">Crisis Feed</NavLink>
          <NavLink to="/market-intelligence">Market Intelligence</NavLink>
          <NavLink to="/assistant">AI Assistant</NavLink>
        </nav>
      </header>
      {children}
    </div>
  );
}
