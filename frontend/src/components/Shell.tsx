import { useState, useRef, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Radio,
  TrendingUp,
  BarChart2,
  BotMessageSquare,
  ChevronLeft,
  ChevronRight,
  Activity,
  User,
  Settings as SettingsIcon,
  LogOut,
  ChevronDown,
  Home,
  Globe
} from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { to: "/dashboard",           icon: LayoutDashboard, label: "Dashboard",    desc: "Operations center" },
  { to: "/crisis-feed",         icon: Radio,           label: "Intel Feed",   desc: "Live intelligence" },
  { to: "/market-intelligence", icon: TrendingUp,      label: "Asset Intel",  desc: "Market exposure" },
  { to: "/source-analytics",    icon: BarChart2,       label: "Analytics",    desc: "Source quality" },
  { to: "/assistant",           icon: BotMessageSquare,label: "AI Analyst",   desc: "Strategic analyst" },
  { to: "/settings",            icon: SettingsIcon,    label: "Settings",     desc: "System preferences" },
] as const;

export function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { email } = useAuthStore();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.full_name) {
        setProfileName(data.user.user_metadata.full_name);
      }
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return "U";
  };

  return (
    <div className={`shell ${collapsed ? "shell--collapsed" : ""}`}>
      {/* Left Sidebar */}
      <aside className="sidebar">
        {/* Brand — clicking logo goes to home */}
        <div className="sidebar-brand">
          <Link to="/" className="sidebar-brand-link">
            <div className="sidebar-logo">
              <Activity size={14} strokeWidth={2.5} />
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="sidebar-brand-text"
              >
                <strong>GLOBINTEL</strong>
                <small>Global Market Surveillance</small>
              </motion.div>
            )}
          </Link>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Live indicator */}
        <div className="sidebar-live">
          <span className="live-dot" />
          {!collapsed && <span className="live-label">LIVE FEEDS ACTIVE</span>}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "sidebar-nav-item--active" : ""}`
              }
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <span className={`sidebar-nav-icon ${isActive ? "active" : ""}`}>
                    <item.icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                  </span>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        className="sidebar-nav-label"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15 }}
                      >
                        <span className="sidebar-nav-name">{item.label}</span>
                        <span className="sidebar-nav-desc">{item.desc}</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isActive && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="sidebar-nav-indicator"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {!collapsed && (
            <div className="sidebar-footer-info">
              <Globe size={11} />
              <span>Monitoring 40+ sources</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div className="shell-content">
        <header className="shell-header">
          <div className="shell-header-spacer"></div>
          <div className="shell-user-menu-container" ref={menuRef}>
            <button className="shell-user-btn" onClick={() => setMenuOpen(!menuOpen)}>
              <div className="shell-user-avatar">
                {getInitials(profileName, email || "")}
              </div>
              <span className="shell-user-name">{profileName || email?.split("@")[0] || "User"}</span>
              <ChevronDown size={14} className={`shell-user-chevron ${menuOpen ? 'open' : ''}`} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  className="shell-user-dropdown"
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="dropdown-header">
                    <strong>{profileName || "User"}</strong>
                    <small>{email}</small>
                  </div>
                  <div className="dropdown-divider"></div>
                  <Link to="/" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <Home size={14} />
                    <span>Home</span>
                  </Link>
                  <Link to="/dashboard" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <LayoutDashboard size={14} />
                    <span>Dashboard</span>
                  </Link>
                  <Link to="/profile" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <User size={14} />
                    <span>Profile</span>
                  </Link>
                  <Link to="/settings" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <SettingsIcon size={14} />
                    <span>Settings</span>
                  </Link>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item dropdown-logout" onClick={handleLogout}>
                    <LogOut size={14} />
                    <span>Logout</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>
        <main className="shell-main">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
