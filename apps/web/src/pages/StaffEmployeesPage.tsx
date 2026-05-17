import { useEffect, useState, useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiJson } from "../api";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  status: "active" | "inactive";
  dateOfJoining: string;
  baseSalary: number;
};

type Attendance = {
  id?: string;
  employeeId: string;
  date: string;
  status: "present" | "absent" | "leave";
  checkInTime?: string;
  checkOutTime?: string;
};

type Payroll = {
  id?: string;
  employeeId: string;
  month: string;
  baseSalaryPaid: number;
  bonus: number;
  deductions: number;
  netPaid: number;
  status: "pending" | "paid";
  paymentDate?: string;
};

type Shift = {
  id: string;
  employeeId: string;
  date: string;
  shiftType: "morning" | "evening" | "night";
  startTime: string;
  endTime: string;
  notes?: string;
};

export function StaffEmployeesPage() {
  const token = localStorage.getItem("staff_token");
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<"records" | "attendance" | "payroll" | "shifts">("records");

  // Loaders
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Employee CRUD states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Add Employee Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Chef");
  const [phone, setPhone] = useState("");
  const [baseSalary, setBaseSalary] = useState(25000);
  const [status, setStatus] = useState<"active" | "inactive">("active");

  // Edit Employee Form State
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBaseSalary, setEditBaseSalary] = useState(0);
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");

  // Attendance states
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  // Payroll states
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  });
  const [bonusInputs, setBonusInputs] = useState<Record<string, number>>({});
  const [deductionInputs, setDeductionInputs] = useState<Record<string, number>>({});

  // Shift form states
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftEmpId, setShiftEmpId] = useState("");
  const [shiftDate, setShiftDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [shiftType, setShiftType] = useState<"morning" | "evening" | "night">("morning");
  const [shiftStartTime, setShiftStartTime] = useState("09:00 AM");
  const [shiftEndTime, setShiftEndTime] = useState("05:00 PM");
  const [shiftNotes, setShiftNotes] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [empList, attList, payList, shiftList] = await Promise.all([
        apiJson<Employee[]>("/api/staff/employees"),
        apiJson<Attendance[]>("/api/staff/employees/attendance"),
        apiJson<Payroll[]>("/api/staff/employees/payroll"),
        apiJson<Shift[]>("/api/staff/employees/shifts"),
      ]);
      setEmployees(empList);
      setAttendance(attList);
      setPayroll(payList);
      setShifts(shiftList);
      if (empList.length > 0 && !shiftEmpId) {
        setShiftEmpId(empList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load employee systems");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  // Employee Add Handler
  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await apiJson("/api/staff/employees", {
        method: "POST",
        json: { name, email, role, phone, baseSalary, status },
      });
      setName("");
      setEmail("");
      setPhone("");
      setBaseSalary(25000);
      setStatus("active");
      setShowAddForm(false);
      setSuccess("Employee record added successfully!");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create employee profile");
    }
  }

  // Employee Edit Trigger
  function handleStartEdit(emp: Employee) {
    setEditingId(emp.id);
    setEditName(emp.name);
    setEditEmail(emp.email);
    setEditRole(emp.role);
    setEditPhone(emp.phone);
    setEditBaseSalary(emp.baseSalary);
    setEditStatus(emp.status);
  }

  // Employee Save Edit
  async function handleSaveEdit(id: string) {
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/api/staff/employees/${id}`, {
        method: "PATCH",
        json: {
          name: editName,
          email: editEmail,
          role: editRole,
          phone: editPhone,
          baseSalary: editBaseSalary,
          status: editStatus,
        },
      });
      setEditingId(null);
      setSuccess("Employee profile updated!");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile changes");
    }
  }

  // Employee Delete
  async function handleDeleteEmployee(emp: Employee) {
    if (!window.confirm(`Are you absolutely sure you want to delete employee "${emp.name}"? All associated attendance, shifts, and payroll history will be permanently deleted.`)) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/api/staff/employees/${emp.id}`, {
        method: "DELETE",
      });
      setSuccess("Employee deleted successfully");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete employee");
    }
  }

  // Attendance status update
  async function handleUpdateAttendance(employeeId: string, attStatus: "present" | "absent" | "leave") {
    setError(null);
    setSuccess(null);
    const existing = attendance.find(a => a.employeeId === employeeId && a.date === selectedDate);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const checkIn = attStatus === "present" ? (existing?.checkInTime || "09:00 AM") : "";
    const checkOut = attStatus === "present" ? (existing?.checkOutTime || "05:00 PM") : "";

    try {
      await apiJson("/api/staff/employees/attendance", {
        method: "POST",
        json: {
          employeeId,
          date: selectedDate,
          status: attStatus,
          checkInTime: checkIn,
          checkOutTime: checkOut,
        },
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attendance record");
    }
  }

  // Attendance times update
  async function handleUpdateTimes(employeeId: string, checkIn: string, checkOut: string) {
    setError(null);
    setSuccess(null);
    const existing = attendance.find(a => a.employeeId === employeeId && a.date === selectedDate);
    if (!existing) return;
    try {
      await apiJson("/api/staff/employees/attendance", {
        method: "POST",
        json: {
          employeeId,
          date: selectedDate,
          status: existing.status,
          checkInTime: checkIn,
          checkOutTime: checkOut,
        },
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save checkin times");
    }
  }

  // Payroll Pay Handler
  async function handlePaySalary(employeeId: string, base: number) {
    setError(null);
    setSuccess(null);
    const bonus = bonusInputs[employeeId] || 0;
    const deductions = deductionInputs[employeeId] || 0;
    try {
      await apiJson("/api/staff/employees/payroll", {
        method: "POST",
        json: {
          employeeId,
          month: selectedMonth,
          baseSalaryPaid: base,
          bonus,
          deductions,
          status: "paid",
        },
      });
      setSuccess(`Salary successfully logged as paid for this employee!`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete payroll log");
    }
  }

  // Add Shift Assignment
  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!shiftEmpId) return;
    try {
      await apiJson("/api/staff/employees/shifts", {
        method: "POST",
        json: {
          employeeId: shiftEmpId,
          date: shiftDate,
          shiftType,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
          notes: shiftNotes,
        },
      });
      setShiftNotes("");
      setShowShiftForm(false);
      setSuccess("Shift assigned successfully!");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule shift");
    }
  }

  // Delete Shift Assignment
  async function handleDeleteShift(id: string) {
    if (!window.confirm("Remove this shift scheduling?")) return;
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/api/staff/employees/shifts/${id}`, {
        method: "DELETE",
      });
      setSuccess("Shift scheduled deleted");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete shift");
    }
  }

  // Helper: map employee name
  function getEmpName(id: string) {
    return employees.find(e => e.id === id)?.name || "Unknown Staff";
  }

  // statistics computed reactively
  const stats = useMemo(() => {
    const presentToday = attendance.filter(a => a.date === selectedDate && a.status === "present").length;
    const activeStaff = employees.filter(e => e.status === "active").length;
    const totalSpentPayroll = payroll.filter(p => p.status === "paid").reduce((sum, p) => sum + p.netPaid, 0);
    return {
      activeStaff,
      presentToday,
      totalSpentPayroll,
      shiftCount: shifts.length,
    };
  }, [employees, attendance, payroll, shifts, selectedDate]);

  if (!token) return <Navigate to="/staff/login" replace />;

  return (
    <div className="fade-in animate-in">
      <Link to="/staff" className="back-link">
        ← Back to Dashboard
      </Link>

      <div className="section-heading" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="section-heading-icon" style={{ background: "linear-gradient(135deg, var(--purple), #8b5cf6)", boxShadow: "0 0 16px rgba(139, 92, 246, 0.4)" }}>
            👤
          </div>
          <h2 style={{ fontSize: "1.4rem" }}>Employee Management</h2>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className={`sm ${activeTab === "records" ? "primary" : ""}`} onClick={() => setActiveTab("records")}>👤 Profiles</button>
          <button className={`sm ${activeTab === "attendance" ? "primary" : ""}`} onClick={() => setActiveTab("attendance")}>📅 Attendance</button>
          <button className={`sm ${activeTab === "payroll" ? "primary" : ""}`} onClick={() => setActiveTab("payroll")}>💰 Payroll</button>
          <button className={`sm ${activeTab === "shifts" ? "primary" : ""}`} onClick={() => setActiveTab("shifts")}>⏰ Shifts</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Statistics Tiles Grid */}
      <div className="stat-grid" style={{ marginBottom: "28px" }}>
        <div className="stat-tile">
          <div className="stat-tile-value" style={{ color: "var(--blue)" }}>{stats.activeStaff}</div>
          <div className="stat-tile-label">Active Staff</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value" style={{ color: "var(--green)" }}>{stats.presentToday}</div>
          <div className="stat-tile-label">Present Today</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value" style={{ color: "var(--amber)" }}>{stats.shiftCount}</div>
          <div className="stat-tile-label">Scheduled Shifts</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value" style={{ color: "var(--purple)" }}>₹{stats.totalSpentPayroll}</div>
          <div className="stat-tile-label">Total Paid Salary</div>
        </div>
      </div>

      {loading && (
        <div className="empty">
          <div className="spinner" style={{ margin: "20px auto" }}></div>
          <div className="empty-text">Syncing employee records...</div>
        </div>
      )}

      {/* TAB 1: EMPLOYEE PROFILES */}
      {!loading && activeTab === "records" && (
        <div className="fade-in animate-in">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.1rem", margin: 0 }}>Employee Records</h3>
            <button className="primary sm" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? "✕ Close Form" : "➕ Add Employee"}
            </button>
          </div>

          {showAddForm && (
            <div className="card" style={{ marginBottom: "24px" }}>
              <div className="card-title">Add New Employee Profile</div>
              <form onSubmit={handleAddEmployee}>
                <div className="form-row">
                  <div className="form-group" style={{ flex: "2", minWidth: "200px" }}>
                    <label>Full Name</label>
                    <input type="text" placeholder="e.g. Ramesh Kumar" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ flex: "2", minWidth: "200px" }}>
                    <label>Email Address</label>
                    <input type="email" placeholder="ramesh@iris.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ minWidth: "150px" }}>
                    <label>Role</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)}>
                      <option value="Manager">Manager</option>
                      <option value="Chef">Chef</option>
                      <option value="Server">Server</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Cleaner">Cleaner</option>
                    </select>
                  </div>
                </div>
                <div className="form-row" style={{ marginTop: "12px" }}>
                  <div className="form-group" style={{ minWidth: "150px" }}>
                    <label>Phone Number</label>
                    <input type="text" placeholder="e.g. 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ minWidth: "150px" }}>
                    <label>Base Salary (₹)</label>
                    <input type="number" min="0" value={baseSalary} onChange={(e) => setBaseSalary(Number(e.target.value))} required />
                  </div>
                  <div className="form-group" style={{ minWidth: "150px" }}>
                    <label>Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                      <option value="active">🟢 Active</option>
                      <option value="inactive">🔴 Inactive</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ minWidth: "150px", display: "flex", alignItems: "flex-end" }}>
                    <button type="submit" className="primary" style={{ width: "100%", height: "42px" }}>Create Record</button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            {employees.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">👥</div>
                <div className="empty-text">No employee profiles registered yet.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)", height: "46px" }}>
                      <th style={{ padding: "12px 20px" }}>Name</th>
                      <th style={{ padding: "12px 20px" }}>Contact</th>
                      <th style={{ padding: "12px 20px" }}>Role</th>
                      <th style={{ padding: "12px 20px", textAlign: "right" }}>Base Salary</th>
                      <th style={{ padding: "12px 20px" }}>Joining Date</th>
                      <th style={{ padding: "12px 20px" }}>Status</th>
                      <th style={{ padding: "12px 20px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => {
                      const isEditing = editingId === emp.id;
                      return (
                        <tr key={emp.id} style={{ borderBottom: "1px solid var(--border)", height: "64px" }}>
                          {/* Name */}
                          <td style={{ padding: "12px 20px" }}>
                            {isEditing ? (
                              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ padding: "4px 8px", height: "32px" }} />
                            ) : (
                              <span style={{ fontWeight: "600", color: "var(--text)" }}>{emp.name}</span>
                            )}
                          </td>
                          {/* Contact */}
                          <td style={{ padding: "12px 20px" }}>
                            {isEditing ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ padding: "4px 8px", height: "30px", fontSize: "0.8rem" }} />
                                <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={{ padding: "4px 8px", height: "30px", fontSize: "0.8rem" }} />
                              </div>
                            ) : (
                              <div style={{ fontSize: "0.85rem" }}>
                                <div style={{ color: "var(--text)" }}>{emp.phone}</div>
                                <div className="muted">{emp.email}</div>
                              </div>
                            )}
                          </td>
                          {/* Role */}
                          <td style={{ padding: "12px 20px" }}>
                            {isEditing ? (
                              <select value={editRole} onChange={(e) => setEditRole(e.target.value)} style={{ padding: "4px 8px", height: "32px" }}>
                                <option value="Manager">Manager</option>
                                <option value="Chef">Chef</option>
                                <option value="Server">Server</option>
                                <option value="Cashier">Cashier</option>
                                <option value="Cleaner">Cleaner</option>
                              </select>
                            ) : (
                              <span style={{ fontSize: "0.75rem", background: "var(--surface-3)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: "14px", color: "var(--text-2)" }}>
                                {emp.role}
                              </span>
                            )}
                          </td>
                          {/* Salary */}
                          <td style={{ padding: "12px 20px", textAlign: "right" }}>
                            {isEditing ? (
                              <input type="number" value={editBaseSalary} onChange={(e) => setEditBaseSalary(Number(e.target.value))} style={{ padding: "4px 8px", height: "32px", width: "100px", textAlign: "right" }} />
                            ) : (
                              <span style={{ fontWeight: "700" }}>₹{emp.baseSalary}</span>
                            )}
                          </td>
                          {/* Joining */}
                          <td style={{ padding: "12px 20px", color: "var(--text-3)", fontSize: "0.85rem" }}>
                            {new Date(emp.dateOfJoining).toLocaleDateString([], { dateStyle: "medium" })}
                          </td>
                          {/* Status */}
                          <td style={{ padding: "12px 20px" }}>
                            {isEditing ? (
                              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)} style={{ padding: "4px 8px", height: "32px" }}>
                                <option value="active">🟢 Active</option>
                                <option value="inactive">🔴 Inactive</option>
                              </select>
                            ) : (
                              <span className={`badge ${emp.status === "active" ? "vacant" : "occupied"}`} style={{ borderColor: emp.status === "active" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)" }}>
                                <span className="badge-dot" style={{ background: emp.status === "active" ? "var(--green)" : "var(--red)" }}></span>
                                {emp.status === "active" ? "Active" : "Inactive"}
                              </span>
                            )}
                          </td>
                          {/* Actions */}
                          <td style={{ padding: "12px 20px", textAlign: "right" }}>
                            {isEditing ? (
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                <button className="success sm" onClick={() => handleSaveEdit(emp.id)}>💾 Save</button>
                                <button className="sm" onClick={() => setEditingId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                <button className="sm" onClick={() => handleStartEdit(emp)}>✏️</button>
                                <button className="danger sm" onClick={() => handleDeleteEmployee(emp)}>🗑️</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE TRACKING */}
      {!loading && activeTab === "attendance" && (
        <div className="fade-in animate-in">
          <div className="card" style={{ padding: "20px", marginBottom: "24px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.2rem" }}>📅</span>
                <span style={{ fontWeight: "700" }}>Select Attendance Date:</span>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ padding: "6px 12px", borderRadius: "8px", background: "var(--surface-3)", border: "1px solid var(--border)", color: "#fff", width: "160px" }} />
              </div>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Attendance state is automatically stored to database.</span>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {employees.filter(e => e.status === "active").length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📅</div>
                <div className="empty-text">No active employee profiles found to track attendance.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)", height: "46px" }}>
                      <th style={{ padding: "12px 20px" }}>Employee</th>
                      <th style={{ padding: "12px 20px" }}>Role</th>
                      <th style={{ padding: "12px 20px" }}>Date</th>
                      <th style={{ padding: "12px 20px", textAlign: "center" }}>Mark Attendance</th>
                      <th style={{ padding: "12px 20px" }}>Check In / Out Times</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(e => e.status === "active").map((emp) => {
                      const record = attendance.find(a => a.employeeId === emp.id && a.date === selectedDate);
                      const isPresent = record?.status === "present";
                      const isAbsent = record?.status === "absent";
                      const isLeave = record?.status === "leave";

                      return (
                        <tr key={emp.id} style={{ borderBottom: "1px solid var(--border)", height: "64px" }}>
                          {/* Employee */}
                          <td style={{ padding: "12px 20px" }}>
                            <span style={{ fontWeight: "600", color: "var(--text)" }}>{emp.name}</span>
                          </td>
                          {/* Role */}
                          <td style={{ padding: "12px 20px" }}>
                            <span className="muted">{emp.role}</span>
                          </td>
                          {/* Date */}
                          <td style={{ padding: "12px 20px", color: "var(--text-3)" }}>{selectedDate}</td>
                          {/* Toggles */}
                          <td style={{ padding: "12px 20px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <button className={`sm ${isPresent ? "success" : ""}`} onClick={() => handleUpdateAttendance(emp.id, "present")} style={{ borderRadius: "15px", padding: "4px 12px", background: isPresent ? undefined : "rgba(255,255,255,0.05)" }}>🟢 Present</button>
                              <button className={`sm ${isAbsent ? "danger" : ""}`} onClick={() => handleUpdateAttendance(emp.id, "absent")} style={{ borderRadius: "15px", padding: "4px 12px", background: isAbsent ? undefined : "rgba(255,255,255,0.05)" }}>🔴 Absent</button>
                              <button className={`sm ${isLeave ? "warning" : ""}`} onClick={() => handleUpdateAttendance(emp.id, "leave")} style={{ borderRadius: "15px", padding: "4px 12px", background: isLeave ? undefined : "rgba(255,255,255,0.05)", borderColor: isLeave ? "var(--amber)" : undefined, color: isLeave ? "#fff" : undefined }}>🟡 Leave</button>
                            </div>
                          </td>
                          {/* CheckIn/CheckOut Timestamps */}
                          <td style={{ padding: "12px 20px" }}>
                            {isPresent ? (
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                <input type="text" placeholder="In: 09:00 AM" value={record.checkInTime || ""} onChange={(e) => handleUpdateTimes(emp.id, e.target.value, record.checkOutTime || "")} style={{ padding: "2px 6px", height: "26px", fontSize: "0.75rem", width: "80px", background: "var(--surface-3)", border: "1px solid var(--border)", color: "#fff", borderRadius: "4px" }} />
                                <span className="muted">to</span>
                                <input type="text" placeholder="Out: 05:00 PM" value={record.checkOutTime || ""} onChange={(e) => handleUpdateTimes(emp.id, record.checkInTime || "", e.target.value)} style={{ padding: "2px 6px", height: "26px", fontSize: "0.75rem", width: "80px", background: "var(--surface-3)", border: "1px solid var(--border)", color: "#fff", borderRadius: "4px" }} />
                              </div>
                            ) : (
                              <span className="muted" style={{ fontSize: "0.85rem" }}>N/A (Not Present)</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SALARY DETAILS & PAYROLL */}
      {!loading && activeTab === "payroll" && (
        <div className="fade-in animate-in">
          <div className="card" style={{ padding: "20px", marginBottom: "24px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.2rem" }}>💰</span>
                <span style={{ fontWeight: "700" }}>Select Salary Month:</span>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: "6px 12px", borderRadius: "8px", background: "var(--surface-3)", border: "1px solid var(--border)", color: "#fff", width: "160px" }} />
              </div>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Process payments and bonuses dynamically for each month.</span>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {employees.filter(e => e.status === "active").length === 0 ? (
              <div className="empty">
                <div className="empty-icon">💰</div>
                <div className="empty-text">No active employee records available to pay.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)", height: "46px" }}>
                      <th style={{ padding: "12px 20px" }}>Employee</th>
                      <th style={{ padding: "12px 20px" }}>Base Salary</th>
                      <th style={{ padding: "12px 20px" }}>Bonus (₹)</th>
                      <th style={{ padding: "12px 20px" }}>Deductions (₹)</th>
                      <th style={{ padding: "12px 20px", textAlign: "right" }}>Net Salary</th>
                      <th style={{ padding: "12px 20px" }}>Payment Status</th>
                      <th style={{ padding: "12px 20px", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(e => e.status === "active").map((emp) => {
                      const record = payroll.find(p => p.employeeId === emp.id && p.month === selectedMonth);
                      const isPaid = record?.status === "paid";
                      
                      const bonus = isPaid ? record.bonus : (bonusInputs[emp.id] || 0);
                      const deductions = isPaid ? record.deductions : (deductionInputs[emp.id] || 0);
                      const netPay = isPaid ? record.netPaid : (emp.baseSalary + bonus - deductions);

                      return (
                        <tr key={emp.id} style={{ borderBottom: "1px solid var(--border)", height: "64px" }}>
                          {/* Employee */}
                          <td style={{ padding: "12px 20px" }}>
                            <div style={{ fontWeight: "600", color: "var(--text)" }}>{emp.name}</div>
                            <span className="muted" style={{ fontSize: "0.75rem" }}>{emp.role}</span>
                          </td>
                          {/* Base */}
                          <td style={{ padding: "12px 20px" }}>₹{emp.baseSalary}</td>
                          {/* Bonus */}
                          <td style={{ padding: "12px 20px" }}>
                            {isPaid ? (
                              <span style={{ color: "var(--green)" }}>+₹{bonus}</span>
                            ) : (
                              <input type="number" min="0" placeholder="0" value={bonusInputs[emp.id] || ""} onChange={(e) => setBonusInputs(prev => ({ ...prev, [emp.id]: Number(e.target.value) }))} style={{ padding: "4px 8px", height: "30px", fontSize: "0.85rem", width: "80px", background: "var(--surface-3)", border: "1px solid var(--border)", color: "#fff" }} />
                            )}
                          </td>
                          {/* Deductions */}
                          <td style={{ padding: "12px 20px" }}>
                            {isPaid ? (
                              <span style={{ color: "var(--red)" }}>-₹{deductions}</span>
                            ) : (
                              <input type="number" min="0" placeholder="0" value={deductionInputs[emp.id] || ""} onChange={(e) => setDeductionInputs(prev => ({ ...prev, [emp.id]: Number(e.target.value) }))} style={{ padding: "4px 8px", height: "30px", fontSize: "0.85rem", width: "80px", background: "var(--surface-3)", border: "1px solid var(--border)", color: "#fff" }} />
                            )}
                          </td>
                          {/* Net Pay */}
                          <td style={{ padding: "12px 20px", textAlign: "right", fontWeight: "700" }}>₹{netPay}</td>
                          {/* Status */}
                          <td style={{ padding: "12px 20px" }}>
                            <span className={`badge ${isPaid ? "vacant" : "occupied"}`} style={{ borderColor: isPaid ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)" }}>
                              <span className="badge-dot" style={{ background: isPaid ? "var(--green)" : "var(--amber)" }}></span>
                              {isPaid ? "Paid" : "Pending"}
                            </span>
                            {isPaid && record.paymentDate && (
                              <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: "4px" }}>
                                Paid on {new Date(record.paymentDate).toLocaleDateString([], { dateStyle: "short" })}
                              </div>
                            )}
                          </td>
                          {/* Action */}
                          <td style={{ padding: "12px 20px", textAlign: "right" }}>
                            {isPaid ? (
                              <button className="sm" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>✓ Completed</button>
                            ) : (
                              <button className="success sm" onClick={() => handlePaySalary(emp.id, emp.baseSalary)}>💸 Pay Salary</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SHIFT SCHEDULING */}
      {!loading && activeTab === "shifts" && (
        <div className="fade-in animate-in">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.1rem", margin: 0 }}>Shift Schedules</h3>
            <button className="primary sm" onClick={() => setShowShiftForm(!showShiftForm)}>
              {showShiftForm ? "✕ Close Form" : "📅 Assign Shift"}
            </button>
          </div>

          {showShiftForm && (
            <div className="card" style={{ marginBottom: "24px" }}>
              <div className="card-title">Assign Shift Schedule</div>
              <form onSubmit={handleAddShift}>
                <div className="form-row">
                  <div className="form-group" style={{ minWidth: "200px", flex: "1" }}>
                    <label>Select Employee</label>
                    <select value={shiftEmpId} onChange={(e) => setShiftEmpId(e.target.value)} required>
                      {employees.filter(e => e.status === "active").map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ minWidth: "150px" }}>
                    <label>Date</label>
                    <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ minWidth: "150px" }}>
                    <label>Shift Type</label>
                    <select value={shiftType} onChange={(e) => setShiftType(e.target.value as any)}>
                      <option value="morning">🌅 Morning Shift</option>
                      <option value="evening">🌆 Evening Shift</option>
                      <option value="night">🌃 Night Shift</option>
                    </select>
                  </div>
                </div>
                <div className="form-row" style={{ marginTop: "12px" }}>
                  <div className="form-group" style={{ minWidth: "120px" }}>
                    <label>Start Time</label>
                    <input type="text" placeholder="09:00 AM" value={shiftStartTime} onChange={(e) => setShiftStartTime(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ minWidth: "120px" }}>
                    <label>End Time</label>
                    <input type="text" placeholder="05:00 PM" value={shiftEndTime} onChange={(e) => setShiftEndTime(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ flex: "2", minWidth: "200px" }}>
                    <label>Task Notes / Instructions</label>
                    <input type="text" placeholder="e.g. Clean kitchen deck, verify logs" value={shiftNotes} onChange={(e) => setShiftNotes(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ minWidth: "150px", display: "flex", alignItems: "flex-end" }}>
                    <button type="submit" className="primary" style={{ width: "100%", height: "42px" }}>Assign Shift</button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            {shifts.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📅</div>
                <div className="empty-text">No shifts scheduled. Create one to keep the cafe organized!</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)", height: "46px" }}>
                      <th style={{ padding: "12px 20px" }}>Date</th>
                      <th style={{ padding: "12px 20px" }}>Employee</th>
                      <th style={{ padding: "12px 20px" }}>Shift Plan</th>
                      <th style={{ padding: "12px 20px" }}>Timings</th>
                      <th style={{ padding: "12px 20px" }}>Notes / Instructions</th>
                      <th style={{ padding: "12px 20px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", height: "64px" }}>
                        {/* Date */}
                        <td style={{ padding: "12px 20px", fontWeight: "600", color: "var(--text)" }}>{s.date}</td>
                        {/* Employee */}
                        <td style={{ padding: "12px 20px" }}>{getEmpName(s.employeeId)}</td>
                        {/* Shift Plan type */}
                        <td style={{ padding: "12px 20px" }}>
                          <span className={`badge ${s.shiftType === "morning" ? "vacant" : s.shiftType === "evening" ? "occupied" : "occupied"}`} style={{ borderColor: s.shiftType === "morning" ? "rgba(16, 185, 129, 0.3)" : s.shiftType === "evening" ? "rgba(245, 158, 11, 0.3)" : "rgba(139, 92, 246, 0.3)", color: s.shiftType === "morning" ? "#6ee7b7" : s.shiftType === "evening" ? "#fcd34d" : "#c084fc" }}>
                            {s.shiftType === "morning" ? "🌅 Morning" : s.shiftType === "evening" ? "🌆 Evening" : "🌃 Night"}
                          </span>
                        </td>
                        {/* Timings */}
                        <td style={{ padding: "12px 20px", color: "var(--text-2)" }}>{s.startTime} - {s.endTime}</td>
                        {/* Notes */}
                        <td style={{ padding: "12px 20px" }}>
                          <span className="muted" style={{ fontSize: "0.85rem" }}>{s.notes || "—"}</span>
                        </td>
                        {/* Actions */}
                        <td style={{ padding: "12px 20px", textAlign: "right" }}>
                          <button className="danger sm" onClick={() => handleDeleteShift(s.id)}>🗑️ Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
