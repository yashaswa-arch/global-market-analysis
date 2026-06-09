import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase, getAuthRedirectUrl } from "@/lib/supabase";
import "./Auth.css";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl().replace("/auth/callback", "/reset-password"),
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="logo-link"><span className="logo-icon">▲</span></Link>
          <h2>Reset Password</h2>
          <p>We'll send you a link to reset your password.</p>
        </div>

        {success ? (
          <div className="auth-success">
            <h3>Check your email</h3>
            <p>We've sent password reset instructions to <strong>{email}</strong>.</p>
            <Link to="/login" className="auth-submit btn-link">Return to Login</Link>
          </div>
        ) : (
          <>
            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleReset} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input 
                  type="email" 
                  id="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="you@company.com"
                />
              </div>
              
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? "Sending link..." : "Send Reset Link"}
              </button>
            </form>

            <div className="auth-footer">
              <p>Remember your password? <Link to="/login">Sign in</Link></p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
