import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../api";
import logo from "../logo.png";

export function StaffLoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiJson<{ token: string; user: { role: string } }>("/api/staff/auth/login", {
        method: "POST",
        json: { email, password },
      });
      localStorage.setItem("staff_token", res.token);
      localStorage.setItem("staff_role", res.user.role);
      nav("/staff");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-icon">
          <img
            src={logo}
            alt="Iris Cafe"
            style={{
              height: "72px",
              objectFit: "contain",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          />
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-sub">Sign in to the staff dashboard</p>

        {error && (
          <div className="alert alert-error animate-in">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@demo.local"
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button
            className="primary lg"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? <><span className="spinner" />Signing in…</> : "Sign in →"}
          </button>
        </form>

        <p className="text-xs" style={{ textAlign: "center", marginTop: 20 }}>
          Default: admin@demo.local / admin123
        </p>
      </div>
    </div>
  );
}
