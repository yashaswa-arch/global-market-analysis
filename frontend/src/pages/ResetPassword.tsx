import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import "./Auth.css";

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for the password recovery event or verify active session.
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("Invalid or expired password reset link. Please request a new one.");
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;
      
      // Password updated successfully. Redirect to dashboard.
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length > 5) score++;
    if (pwd.length > 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = calculateStrength(password);
  const strengthClass = strength < 2 ? "weak" : strength < 4 ? "fair" : "strong";
  const strengthLabel = strength < 2 ? "Weak" : strength < 4 ? "Fair" : "Strong";

  return (
    <div className="auth-container">
      <div className="auth-card signup-card">
        <div className="auth-header">
          <Link to="/" className="logo-link"><span className="logo-icon">▲</span></Link>
          <h2>Set New Password</h2>
          <p>Please enter your new password below.</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleUpdatePassword} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">New Password</label>
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
            {password.length > 0 && (
              <div className="password-strength">
                <div className="strength-bars">
                  <div className={`strength-bar ${strength >= 1 ? strengthClass : ""}`}></div>
                  <div className={`strength-bar ${strength >= 2 ? strengthClass : ""}`}></div>
                  <div className={`strength-bar ${strength >= 4 ? strengthClass : ""}`}></div>
                </div>
                <span className="strength-label">{strengthLabel}</span>
              </div>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <div className="password-input-wrap">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                id="confirmPassword" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
                placeholder="••••••••"
              />
              <button 
                type="button" 
                className="password-toggle" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          
          <button type="submit" className="auth-submit" disabled={loading || !!error}>
            {loading ? "Updating password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
