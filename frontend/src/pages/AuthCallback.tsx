import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";
import "./Auth.css";

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, isLoading } = useAuthStore();
  const exchangeAttempted = useRef(false);

  useEffect(() => {
    console.log("[AuthCallback] Component mounted or location changed", {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash
    });

    // Supabase returns error in hash fragment sometimes
    const hash = location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(location.search);
    
    const err = hashParams.get("error") || queryParams.get("error");
    const errDesc = hashParams.get("error_description") || queryParams.get("error_description");

    if (err) {
      console.error("[AuthCallback] Verification error from URL:", errDesc || err);
      setError(errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : "Verification failed or link expired.");
      return;
    }

    // Handle PKCE code exchange
    const code = queryParams.get("code");
    if (code && !exchangeAttempted.current) {
      console.log("[AuthCallback] Found PKCE code in URL, exchanging for session...");
      exchangeAttempted.current = true;
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          console.error("[AuthCallback] Error exchanging code for session:", error);
          if (error.message.includes("expired") || error.message.includes("invalid")) {
            setError("This verification link has expired or is invalid. Please request a new one from the login page.");
          } else {
            setError(error.message || "Failed to verify email. Please try again.");
          }
        } else {
          console.log("[AuthCallback] Successfully exchanged code for session", data);
          setSuccess(true);
          // We will rely on the fallback effect below to navigate once userId is set, or just navigate here.
          setTimeout(() => {
            navigate("/dashboard");
          }, 1500);
        }
      });
    } else if (hashParams.get("access_token")) {
      console.log("[AuthCallback] Found access_token in URL hash (Implicit Flow). Manually setting session...");
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");
      
      if (access_token && refresh_token && !exchangeAttempted.current) {
        exchangeAttempted.current = true;
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          if (error) {
            console.error("[AuthCallback] Error setting session from hash:", error);
            setError(error.message || "Failed to verify email. Please try again.");
          } else {
            console.log("[AuthCallback] Successfully set session from hash", data);
            setSuccess(true);
            setTimeout(() => {
              navigate("/dashboard");
            }, 1000);
          }
        });
      }
    } else if (!code && !exchangeAttempted.current) {
      console.log("[AuthCallback] No code or access_token found in URL. Checking if user is already authenticated.");
    }

    // Fallback: If user is already successfully authenticated
    if (userId && !isLoading && !error && !success) {
      console.log("[AuthCallback] User is successfully authenticated, setting success state and redirecting to /dashboard");
      setSuccess(true);
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    }
  }, [location, navigate, userId, isLoading, success, error]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="logo-link"><span className="logo-icon">▲</span></Link>
          <h2>Authentication</h2>
        </div>

        {error ? (
          <div className="auth-error">
            <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--critical)" }}>Verification Failed</h3>
            <p style={{ margin: 0 }}>{error}</p>
            <div style={{ marginTop: "1.5rem" }}>
              <Link to="/login" className="auth-submit btn-link">Return to Login</Link>
            </div>
          </div>
        ) : success ? (
          <div className="auth-success" style={{ marginBottom: 0 }}>
            <h3>Email Verified!</h3>
            <p>Your email has been successfully verified. Redirecting you to the dashboard...</p>
            <Link to="/dashboard" className="auth-submit btn-link">Go to Dashboard now</Link>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
            <p>Verifying your request...</p>
            <div className="spinner" style={{ margin: "1rem auto", width: "30px", height: "30px", border: "2px solid rgba(59,130,246,0.2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
