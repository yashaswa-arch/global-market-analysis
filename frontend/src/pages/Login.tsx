import { useState, useRef } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, Mail } from "lucide-react";
import { supabase, getAuthRedirectUrl } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import "./Auth.css";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const isSubmitting = useRef(false);
  const navigate = useNavigate();
  const { userId, isLoading } = useAuthStore();

  if (!isLoading && userId) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting.current || loading) return;
    isSubmitting.current = true;
    setError(null);
    setResendMessage(null);
    setNeedsConfirmation(false);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setNeedsConfirmation(true);
        }
        throw error;
      }
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (isSubmitting.current || loading) return;
    isSubmitting.current = true;
    setLoading(true);
    setResendMessage(null);
    setError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        }
      });
      if (error) throw error;
      setResendMessage("Verification email resent. Please check your inbox.");
      setNeedsConfirmation(false);
    } catch (err: any) {
      setError(err.message || "Failed to resend confirmation email.");
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="logo-link"><span className="logo-icon">▲</span></Link>
          <h2>Welcome Back</h2>
          <p>Sign in to GlobIntel</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {resendMessage && (
          <div className="auth-success" style={{ marginBottom: "1rem", padding: "1rem" }}>
            <p style={{ margin: 0 }}>{resendMessage}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
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
          <div className="form-group">
            <div className="form-group-header">
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
            </div>
            <div className="password-input-wrap">
              <input 
                type={showPassword ? "text" : "password"} 
                id="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                placeholder="••••••••"
              />
              <button 
                type="button" 
                className="password-toggle" 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>

          {needsConfirmation && (
            <button 
              type="button" 
              className="auth-submit" 
              onClick={handleResendConfirmation} 
              disabled={loading}
              style={{ background: 'transparent', border: '1px solid var(--accent)', marginTop: '0.5rem' }}
            >
              <Mail size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
              Resend Verification Email
            </button>
          )}
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/signup">Request access</Link></p>
        </div>
      </div>
    </div>
  );
}
