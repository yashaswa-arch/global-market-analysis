import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  Bell, Shield, Palette, Eye, EyeOff, Check, X, Key, LogOut,
  Globe, Zap, Mail, Smartphone, AlertTriangle, RefreshCw
} from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import "./Settings.css";

type Section = "notifications" | "security" | "appearance" | "api";

export function Settings() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>("notifications");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Notification preferences
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(false);
  const [notifyAlerts, setNotifyAlerts] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);
  const [notifyBreaking, setNotifyBreaking] = useState(true);

  // Security state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  // Appearance (now comes from context)
  const { theme, compactMode, animationsEnabled, setTheme, setCompactMode, setAnimationsEnabled } = useTheme();

  // User email
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  const showMessage = (type: "success" | "error", text: string, duration = 3500) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), duration);
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    // Persist in Supabase user metadata
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          pref_email_notifications: notifyEmail,
          pref_push_notifications: notifyPush,
          pref_high_alerts: notifyAlerts,
          pref_digest: notifyDigest,
          pref_breaking: notifyBreaking,
        }
      });
      if (error) throw error;
      showMessage("success", "Notification preferences saved.");
    } catch (err: any) {
      showMessage("error", err.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      showMessage("error", "New passwords do not match.");
      return;
    }
    if (newPwd.length < 8) {
      showMessage("error", "Password must be at least 8 characters.");
      return;
    }

    setChangingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      showMessage("success", "Password changed successfully.");
    } catch (err: any) {
      showMessage("error", err.message || "Failed to change password.");
    } finally {
      setChangingPwd(false);
    }
  };

  const handleSaveAppearance = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          pref_theme: theme,
          pref_compact: compactMode,
          pref_animations: animationsEnabled,
        }
      });
      if (error) throw error;
      showMessage("success", "Appearance settings saved.");
    } catch (err: any) {
      showMessage("error", err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const SIDEBAR_ITEMS = [
    { key: "notifications", icon: Bell,    label: "Notifications" },
    { key: "security",      icon: Shield,  label: "Security" },
    { key: "appearance",    icon: Palette, label: "Appearance" },
    { key: "api",           icon: Key,     label: "API Access" },
  ] as const;

  return (
    <div className="settings-page">
      <div className="page">
        <div className="settings-header">
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Manage your account preferences and platform configuration</p>
        </div>

        {message && (
          <div className={`settings-message settings-message--${message.type}`}>
            {message.type === "success" ? <Check size={16} /> : <X size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="settings-layout">
          {/* Sidebar */}
          <aside className="settings-sidebar">
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.key}
                className={`settings-nav-item ${activeSection === item.key ? "settings-nav-item--active" : ""}`}
                onClick={() => setActiveSection(item.key as Section)}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </button>
            ))}
            <div className="settings-sidebar-divider" />
            <button className="settings-nav-item settings-logout-btn" onClick={handleLogout}>
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </aside>

          {/* Content panels */}
          <div className="settings-content">

            {/* ── Notifications ── */}
            {activeSection === "notifications" && (
              <div className="settings-panel">
                <div className="settings-panel-header">
                  <Bell size={18} />
                  <div>
                    <h2>Notification Preferences</h2>
                    <p>Configure how and when you receive alerts from GlobIntel.</p>
                  </div>
                </div>
                <div className="settings-panel-body">
                  <div className="settings-toggle-group">
                    <ToggleRow
                      icon={<Mail size={15} />}
                      title="Email Notifications"
                      subtitle="Receive intel summaries and alerts via email"
                      checked={notifyEmail}
                      onChange={setNotifyEmail}
                    />
                    <ToggleRow
                      icon={<Smartphone size={15} />}
                      title="Push Notifications"
                      subtitle="Browser push notifications for critical events"
                      checked={notifyPush}
                      onChange={setNotifyPush}
                    />
                    <ToggleRow
                      icon={<AlertTriangle size={15} />}
                      title="High-Priority Alerts"
                      subtitle="Immediate notifications for critical risk events"
                      checked={notifyAlerts}
                      onChange={setNotifyAlerts}
                    />
                    <ToggleRow
                      icon={<RefreshCw size={15} />}
                      title="Daily Intel Digest"
                      subtitle="Morning briefing with top market events and AI summary"
                      checked={notifyDigest}
                      onChange={setNotifyDigest}
                    />
                    <ToggleRow
                      icon={<Zap size={15} />}
                      title="Breaking News Alerts"
                      subtitle="Real-time alerts for breaking macroeconomic events"
                      checked={notifyBreaking}
                      onChange={setNotifyBreaking}
                    />
                  </div>
                  <div className="settings-panel-footer">
                    <button
                      onClick={handleSaveNotifications}
                      disabled={saving}
                      className="settings-btn-primary"
                    >
                      {saving ? "Saving..." : "Save Preferences"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Security ── */}
            {activeSection === "security" && (
              <div className="settings-panel">
                <div className="settings-panel-header">
                  <Shield size={18} />
                  <div>
                    <h2>Security</h2>
                    <p>Manage your password, sessions, and account security.</p>
                  </div>
                </div>
                <div className="settings-panel-body">
                  {/* Account info */}
                  <div className="settings-info-card">
                    <div className="settings-info-row">
                      <span className="settings-info-label">Email</span>
                      <span className="settings-info-value">{userEmail}</span>
                    </div>
                    <div className="settings-info-row">
                      <span className="settings-info-label">Auth Provider</span>
                      <span className="settings-info-value">Email / Password</span>
                    </div>
                    <div className="settings-info-row">
                      <span className="settings-info-label">2FA Status</span>
                      <span className="settings-info-value status-warning">Not Enabled</span>
                    </div>
                  </div>

                  {/* Change password form */}
                  <div className="settings-form-section">
                    <h3 className="settings-form-title">Change Password</h3>
                    <form onSubmit={handleChangePassword} className="settings-form">
                      <div className="settings-field">
                        <label className="settings-label">Current Password</label>
                        <div className="settings-input-wrap">
                          <input
                            type={showCurrentPwd ? "text" : "password"}
                            className="settings-input"
                            value={currentPwd}
                            onChange={e => setCurrentPwd(e.target.value)}
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            className="settings-eye-btn"
                            onClick={() => setShowCurrentPwd(v => !v)}
                          >
                            {showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="settings-field">
                        <label className="settings-label">New Password</label>
                        <div className="settings-input-wrap">
                          <input
                            type={showNewPwd ? "text" : "password"}
                            className="settings-input"
                            value={newPwd}
                            onChange={e => setNewPwd(e.target.value)}
                            placeholder="Min. 8 characters"
                          />
                          <button
                            type="button"
                            className="settings-eye-btn"
                            onClick={() => setShowNewPwd(v => !v)}
                          >
                            {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {newPwd && newPwd.length < 8 && (
                          <span className="settings-field-error">At least 8 characters required</span>
                        )}
                      </div>

                      <div className="settings-field">
                        <label className="settings-label">Confirm New Password</label>
                        <div className="settings-input-wrap">
                          <input
                            type={showConfirmPwd ? "text" : "password"}
                            className="settings-input"
                            value={confirmPwd}
                            onChange={e => setConfirmPwd(e.target.value)}
                            placeholder="Repeat new password"
                          />
                          <button
                            type="button"
                            className="settings-eye-btn"
                            onClick={() => setShowConfirmPwd(v => !v)}
                          >
                            {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {confirmPwd && newPwd !== confirmPwd && (
                          <span className="settings-field-error">Passwords do not match</span>
                        )}
                      </div>

                      <div className="settings-panel-footer">
                        <button
                          type="submit"
                          disabled={changingPwd || !newPwd || !confirmPwd || newPwd.length < 8}
                          className="settings-btn-primary"
                        >
                          {changingPwd ? "Updating..." : "Update Password"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* ── Appearance ── */}
            {activeSection === "appearance" && (
              <div className="settings-panel">
                <div className="settings-panel-header">
                  <Palette size={18} />
                  <div>
                    <h2>Appearance</h2>
                    <p>Customize the look and feel of the platform.</p>
                  </div>
                </div>
                <div className="settings-panel-body">
                  {/* Theme picker */}
                  <div className="settings-theme-group">
                    <label className="settings-group-label">Color Theme</label>
                    <div className="settings-theme-options">
                      {(["dark", "light"] as const).map(t => (
                        <button
                          key={t}
                          className={`settings-theme-card ${theme === t ? "settings-theme-card--active" : ""}`}
                          onClick={() => setTheme(t)}
                        >
                          <div className={`settings-theme-preview settings-theme-preview--${t}`}></div>
                          <span>{t === "dark" ? "Dark Mode" : "Light Mode"}</span>
                          {theme === t && <Check size={14} className="settings-theme-check" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-toggle-group" style={{ marginTop: "24px" }}>
                    <ToggleRow
                      icon={<Globe size={15} />}
                      title="Compact Mode"
                      subtitle="Reduce spacing for higher information density"
                      checked={compactMode}
                      onChange={setCompactMode}
                    />
                    <ToggleRow
                      icon={<Zap size={15} />}
                      title="UI Animations"
                      subtitle="Enable motion transitions and micro-animations"
                      checked={animationsEnabled}
                      onChange={setAnimationsEnabled}
                    />
                  </div>

                  <div className="settings-panel-footer">
                    <button
                      onClick={handleSaveAppearance}
                      disabled={saving}
                      className="settings-btn-primary"
                    >
                      {saving ? "Saving..." : "Save Appearance"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── API Access ── */}
            {activeSection === "api" && (
              <div className="settings-panel">
                <div className="settings-panel-header">
                  <Key size={18} />
                  <div>
                    <h2>API Access</h2>
                    <p>Manage API keys and integration tokens for the platform.</p>
                  </div>
                </div>
                <div className="settings-panel-body">
                  <div className="api-key-section">
                    <p className="api-key-description">
                      Use API keys to access GlobIntel data programmatically. Keep your keys secure —
                      they provide full access to your account data.
                    </p>
                    <div className="api-key-card">
                      <div className="api-key-header">
                        <span className="api-key-name">Primary API Key</span>
                        <span className="api-key-badge">Active</span>
                      </div>
                      <div className="api-key-value">
                        <code className="api-key-masked">globintel_••••••••••••••••••••••••••••••••</code>
                      </div>
                      <div className="api-key-meta">
                        <span>Created: Jan 1, 2025</span>
                        <span>Last used: Today</span>
                      </div>
                    </div>
                    <div className="api-info-box">
                      <AlertTriangle size={14} />
                      <p>API key management with key generation and revocation is coming in a future release.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon, title, subtitle, checked, onChange
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="settings-toggle-row">
      <div className="settings-toggle-icon">{icon}</div>
      <div className="settings-toggle-text">
        <span className="settings-toggle-title">{title}</span>
        <span className="settings-toggle-subtitle">{subtitle}</span>
      </div>
      <button
        className={`settings-toggle-switch ${checked ? "settings-toggle-switch--on" : ""}`}
        onClick={() => onChange(!checked)}
        aria-checked={checked}
        role="switch"
      >
        <span className="settings-toggle-thumb" />
      </button>
    </div>
  );
}
