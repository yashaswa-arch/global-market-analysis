import { useState, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase, getAuthRedirectUrl } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import "./Auth.css";

export function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const isSubmitting = useRef(false);
  const { userId, isLoading } = useAuthStore();

  if (!isLoading && userId) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting.current || loading) return;
    isSubmitting.current = true;
    setError(null);
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      isSubmitting.current = false;
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      isSubmitting.current = false;
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: getAuthRedirectUrl(),
        }
      });

      if (error) throw error;
      
      // If identities is empty, it means the user already exists
      if (data?.user?.identities && data.user.identities.length === 0) {
        throw new Error("This email is already registered. Please sign in, or if you haven't verified it yet, you can resend the verification email from the login page.");
      }
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
    } finally {
      isSubmitting.current = false;
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
          <h2>Create Account</h2>
          <p>Join GlobIntel</p>
        </div>

        {success ? (
          <div className="auth-success">
            <h3>Check your email</h3>
            <p>We've sent a verification link to <strong>{email}</strong>. Please verify your email to access your account.</p>
            <Link to="/login" className="auth-submit btn-link">Return to Login</Link>
          </div>
        ) : (
          <>
            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSignup} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input 
              type="text" 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              placeholder="John Doe"
            />
          </div>
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
            <label htmlFor="password">Password</label>
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
            <label htmlFor="confirmPassword">Confirm Password</label>
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
          
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
