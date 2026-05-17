import { Link, Navigate } from "react-router-dom";

function getStaffRole(): string | null {
  const token = localStorage.getItem("staff_token");
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const parsed = JSON.parse(jsonPayload);
    return parsed.role || null;
  } catch (e) {
    return null;
  }
}

export function StaffHomePage() {
  const token = localStorage.getItem("staff_token");
  const userRole = getStaffRole();

  if (!token) return <Navigate to="/staff/login" replace />;

  return (
    <div className="fade-in">
      <div className="section-heading">
        <div className="section-heading-icon" style={{ background: "linear-gradient(135deg, var(--blue), var(--purple))", boxShadow: "0 0 16px var(--blue-glow)" }}>
          ✨
        </div>
        <h2 style={{ fontSize: "1.4rem" }}>Staff Dashboard</h2>
      </div>
      
      <p className="muted" style={{ marginBottom: 28, fontSize: "0.95rem" }}>
        Welcome back. Manage your floor, track active orders, and keep Iris Cafe running smoothly.
      </p>

      <div className="home-nav-grid">
        <Link to="/staff/tables" className="home-nav-card">
          <div className="home-nav-icon">🪑</div>
          <div className="home-nav-label">Table Management</div>
          <div className="home-nav-desc">View the floor plan, open dining sessions, seat guests, and generate links.</div>
        </Link>
        
        <Link to="/staff/orders" className="home-nav-card">
          <div className="home-nav-icon">🧾</div>
          <div className="home-nav-label">Active Orders</div>
          <div className="home-nav-desc">Process kitchen tickets, update statuses, calculate taxes, and print bills.</div>
        </Link>

        <Link to="/staff/inventory" className="home-nav-card">
          <div className="home-nav-icon">🥬</div>
          <div className="home-nav-label">Inventory Management</div>
          <div className="home-nav-desc">Track stock levels, set low stock thresholds, and manage menu ingredients.</div>
        </Link>

        {userRole === "admin" && (
          <Link to="/staff/employees" className="home-nav-card">
            <div className="home-nav-icon">👤</div>
            <div className="home-nav-label">Employee Management</div>
            <div className="home-nav-desc">Manage employee profiles, track attendance, calculate payroll, and schedule shifts.</div>
          </Link>
        )}
      </div>
    </div>
  );
}
