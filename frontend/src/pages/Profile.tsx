import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Camera, Edit2, Save, X, Check, Shield, Mail, Calendar, Activity, Zap, Star, MessageSquare } from "lucide-react";
import "./Profile.css";

interface UserProfile {
  full_name: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  avatar_url?: string;
}

export function Profile() {
  const { email } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setProfile({
          full_name: data.user.user_metadata?.full_name || "",
          email: data.user.email || "",
          created_at: data.user.created_at,
          email_confirmed_at: data.user.email_confirmed_at || null,
          last_sign_in_at: data.user.last_sign_in_at || null,
          avatar_url: data.user.user_metadata?.avatar_url || "",
        });
        setEditName(data.user.user_metadata?.full_name || "");
      }
    });
  }, []);

  const getInitials = (name: string, email: string | null) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return "?";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: editName.trim() }
      });

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, full_name: editName.trim() } : null);
      setEditing(false);
      setMessage({ type: "success", text: "Profile updated successfully." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(profile?.full_name || "");
    setEditing(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate: max 2MB, image only
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be under 2MB." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file." });
      return;
    }

    setAvatarUploading(true);
    setMessage(null);

    try {
      // Convert to data URL for local preview (Supabase Storage integration would go here)
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        const { error } = await supabase.auth.updateUser({
          data: { avatar_url: dataUrl }
        });

        if (error) throw error;

        setProfile(prev => prev ? { ...prev, avatar_url: dataUrl } : null);
        setMessage({ type: "success", text: "Profile picture updated." });
        setTimeout(() => setMessage(null), 3000);
        setAvatarUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to upload image." });
      setAvatarUploading(false);
    }
  };

  if (!profile) {
    return (
      <div className="profile-loading">
        <div className="profile-loading-spinner"></div>
        <span>Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="page">
        {/* Page header */}
        <div className="profile-page-header">
          <div>
            <h1 className="profile-page-title">My Profile</h1>
            <p className="profile-page-subtitle">Manage your account information and preferences</p>
          </div>
        </div>

        {message && (
          <div className={`profile-message profile-message--${message.type}`}>
            {message.type === "success" ? <Check size={16} /> : <X size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="profile-layout">
          {/* Left: Identity Card */}
          <div className="profile-identity-card">
            {/* Avatar */}
            <div className="profile-avatar-section">
              <div
                className="profile-avatar-wrapper"
                onClick={handleAvatarClick}
                title="Change profile picture"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="profile-avatar-img"
                  />
                ) : (
                  <div className="profile-avatar-initials">
                    {getInitials(profile.full_name, email)}
                  </div>
                )}
                <div className="profile-avatar-overlay">
                  {avatarUploading ? (
                    <div className="profile-avatar-spinner"></div>
                  ) : (
                    <Camera size={18} />
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: "none" }}
              />
              <p className="profile-avatar-hint">Click to change photo</p>
            </div>

            {/* Identity info */}
            <div className="profile-identity-info">
              {editing ? (
                <div className="profile-edit-name">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="profile-name-input"
                    placeholder="Your full name"
                    autoFocus
                  />
                  <div className="profile-edit-actions">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving || !editName.trim()}
                      className="profile-btn-save"
                    >
                      {saving ? "Saving..." : <><Save size={14} /> Save</>}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="profile-btn-cancel"
                    >
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="profile-name-display">
                  <h2 className="profile-name">{profile.full_name || "No name set"}</h2>
                  <button
                    onClick={() => setEditing(true)}
                    className="profile-edit-btn"
                    title="Edit name"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                </div>
              )}

              <p className="profile-email-display">
                <Mail size={13} />
                {profile.email}
              </p>

              <div className="profile-badges">
                <span className="profile-tier-badge">PRO</span>
                {profile.email_confirmed_at && (
                  <span className="profile-verified-badge">
                    <Shield size={11} /> Verified
                  </span>
                )}
              </div>
            </div>

            {/* Account details */}
            <div className="profile-account-details">
              <div className="profile-detail-row">
                <span className="profile-detail-label">
                  <Calendar size={13} /> Member Since
                </span>
                <span className="profile-detail-value">{formatDate(profile.created_at)}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">
                  <Shield size={13} /> Email Status
                </span>
                <span className={`profile-detail-value ${profile.email_confirmed_at ? "status-verified" : "status-pending"}`}>
                  {profile.email_confirmed_at ? "Verified" : "Pending verification"}
                </span>
              </div>
              {profile.last_sign_in_at && (
                <div className="profile-detail-row">
                  <span className="profile-detail-label">
                    <Activity size={13} /> Last Login
                  </span>
                  <span className="profile-detail-value">{formatDateTime(profile.last_sign_in_at)}</span>
                </div>
              )}
              <div className="profile-detail-row">
                <span className="profile-detail-label">
                  <Zap size={13} /> Account Type
                </span>
                <span className="profile-detail-value accent-text">Professional</span>
              </div>
            </div>
          </div>

          {/* Right: Stats & Activity */}
          <div className="profile-right-panel">
            {/* Activity Statistics */}
            <div className="profile-section">
              <h3 className="profile-section-title">
                <Activity size={15} /> Activity Overview
              </h3>
              <div className="profile-stats-grid">
                <StatBox value="1,245" label="Queries Run" icon={<MessageSquare size={18} />} color="accent" />
                <StatBox value="34" label="Saved Events" icon={<Star size={18} />} color="warning" />
                <StatBox value="12" label="Active Alerts" icon={<Zap size={18} />} color="critical" />
                <StatBox value="8" label="Custom Feeds" icon={<Activity size={18} />} color="good" />
              </div>
            </div>

            {/* API Usage */}
            <div className="profile-section">
              <h3 className="profile-section-title">
                <Zap size={15} /> API Usage — Current Month
              </h3>
              <div className="profile-api-usage">
                <div className="api-usage-header">
                  <span className="api-tier">Standard Tier</span>
                  <span className="api-count">4,200 / 10,000 requests</span>
                </div>
                <div className="api-progress-track">
                  <div className="api-progress-fill" style={{ width: "42%" }}>
                    <span className="api-progress-label">42%</span>
                  </div>
                </div>
                <p className="api-reset-hint">Resets on the 1st of every month.</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="profile-section">
              <h3 className="profile-section-title">
                <Activity size={15} /> Recent Activity
              </h3>
              <div className="profile-activity-list">
                <ActivityItem
                  icon="🔍"
                  title='Searched "Global Semiconductor Supply Chain"'
                  time="2 hours ago"
                  type="search"
                />
                <ActivityItem
                  icon="⭐"
                  title='Saved event "Fed Interest Rate Decision"'
                  time="1 day ago"
                  type="save"
                />
                <ActivityItem
                  icon="🤖"
                  title="Generated Executive Summary for Q2 Earnings"
                  time="3 days ago"
                  type="ai"
                />
                <ActivityItem
                  icon="📊"
                  title="Viewed Source Analytics report"
                  time="4 days ago"
                  type="view"
                />
                <ActivityItem
                  icon="🗺️"
                  title="Explored Global Risk Map — Asia Pacific"
                  time="5 days ago"
                  type="view"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ value, label, icon, color }: {
  value: string; label: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className={`stat-box stat-box--${color}`}>
      <div className="stat-box-icon">{icon}</div>
      <div className="stat-box-value">{value}</div>
      <div className="stat-box-label">{label}</div>
    </div>
  );
}

function ActivityItem({ icon, title, time, type }: {
  icon: string; title: string; time: string; type: string;
}) {
  return (
    <div className={`activity-item activity-item--${type}`}>
      <div className="activity-icon-wrap">{icon}</div>
      <div className="activity-content">
        <span className="activity-title">{title}</span>
        <span className="activity-time">{time}</span>
      </div>
    </div>
  );
}
