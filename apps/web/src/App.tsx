import { Navigate, Route, Routes, Link, useNavigate, useLocation } from "react-router-dom";
import { GuestTablePage } from "./pages/GuestTablePage";
import { GuestLandingPage } from "./pages/GuestLandingPage";
import { StaffLoginPage } from "./pages/StaffLoginPage";
import { StaffHomePage } from "./pages/StaffHomePage";
import { StaffTablesPage } from "./pages/StaffTablesPage";
import { StaffTableServePage } from "./pages/StaffTableServePage";
import { StaffOrdersPage } from "./pages/StaffOrdersPage";
import { StaffInventoryPage } from "./pages/StaffInventoryPage";
import { StaffReviewsPage } from "./pages/StaffReviewsPage";
import { StaffEmployeesPage } from "./pages/StaffEmployeesPage";
import logo from "./logo.png";

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

function StaffShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  function logout() {
    localStorage.removeItem("staff_token");
    localStorage.removeItem("staff_role");
    navigate("/staff/login");
  }

  const isStaff = location.pathname.startsWith("/staff") && location.pathname !== "/staff/login";
  const userRole = getStaffRole();

  return (
    <div className="layout">
      <div className="topbar">
        <Link to="/staff" className="topbar-brand" style={{ textDecoration: "none" }}>
          <img src={logo} alt="Iris Cafe" style={{ height: "54px", objectFit: "contain", marginRight: "8px", borderRadius: "8px" }} />
          <span>Iris Cafe</span>
        </Link>
        {isStaff && (
          <nav className="topbar-nav">
            <Link to="/staff/tables">Tables</Link>
            <Link to="/staff/orders">Orders</Link>
            <Link to="/staff/inventory">Inventory</Link>
            {userRole === "admin" && <Link to="/staff/employees">Employees</Link>}
            <Link to="/staff/reviews">Reviews</Link>
            <button onClick={logout} style={{ color: "var(--text-3)" }}>Sign out</button>
          </nav>
        )}
      </div>
      {children}
    </div>
  );
}

export function App() {
  return (
    <Routes>
      {/* Guest route — no shell */}
      <Route path="/t/:tableSlug" element={<GuestTablePage />} />

      {/* Staff login — centered layout */}
      <Route path="/staff/login" element={<StaffLoginPage />} />

      {/* Staff routes — with shell nav */}
      <Route path="/staff" element={<StaffShell><StaffHomePage /></StaffShell>} />
      <Route path="/staff/tables" element={<StaffShell><StaffTablesPage /></StaffShell>} />
      <Route path="/staff/tables/:tableId/serve" element={<StaffShell><StaffTableServePage /></StaffShell>} />
      <Route path="/staff/orders" element={<StaffShell><StaffOrdersPage /></StaffShell>} />
      <Route path="/staff/inventory" element={<StaffShell><StaffInventoryPage /></StaffShell>} />
      <Route path="/staff/employees" element={
        <StaffShell>
          {getStaffRole() === "admin" ? (
            <StaffEmployeesPage />
          ) : (
            <Navigate to="/staff" replace />
          )}
        </StaffShell>
      } />
      <Route path="/staff/reviews" element={<StaffShell><StaffReviewsPage /></StaffShell>} />

      <Route path="/" element={<GuestLandingPage />} />
      <Route path="*" element={
        <StaffShell>
          <div className="empty">
            <div className="empty-icon">🌌</div>
            <div className="empty-text">Page not found</div>
          </div>
        </StaffShell>
      } />
    </Routes>
  );
}
