import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiJson } from "../api";

type Table = {
  id: string;
  label: string;
  tableSlug: string;
  active: boolean;
  seatCapacity: number;
  sortOrder: number;
  openSessionId: string | null;
  partySize: number;
  occupied: boolean;
  vacantSeats: number;
};

export function StaffTablesPage() {
  const token = localStorage.getItem("staff_token");
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [label, setLabel] = useState("");
  const [newSeats, setNewSeats] = useState(4);
  const [layoutCount, setLayoutCount] = useState(10);
  const [layoutSeats, setLayoutSeats] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedQrTable, setSelectedQrTable] = useState<Table | null>(null);

  async function load() {
    const list = await apiJson<Table[]>("/api/staff/tables");
    setTables(list);
  }

  useEffect(() => {
    if (!token) return;
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [token]);

  const totals = useMemo(() => {
    let totalSeats = 0;
    let vacantSeats = 0;
    for (const t of tables) {
      totalSeats += t.seatCapacity;
      vacantSeats += t.vacantSeats;
    }
    return { totalSeats, vacantSeats };
  }, [tables]);

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedSlug(null);
    const res = await apiJson<{ tableSlug: string }>("/api/staff/tables", {
      method: "POST",
      json: { label, seatCapacity: newSeats },
    });
    setCreatedSlug(res.tableSlug);
    setLabel("");
    await load();
  }

  async function applyLayout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    await apiJson("/api/staff/tables/layout", {
      method: "POST",
      json: { tableCount: layoutCount, seatsEach: layoutSeats },
    });
    await load();
  }

  async function closeSession(tableId: string) {
    setError(null);
    try {
      await apiJson(`/api/staff/tables/${tableId}/close-session`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close session");
    }
  }

  async function deleteTable(table: Table) {
    const msg = table.occupied
      ? `Delete "${table.label}"? This will also close the active session. This cannot be undone.`
      : `Delete "${table.label}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setDeletingId(table.id);
    setError(null);
    try {
      await apiJson(`/api/staff/tables/${table.id}`, { method: "DELETE" });
      // Optimistically remove from state immediately — no flicker, no reappearance.
      setTables((prev) => prev.filter((t) => t.id !== table.id));
      // Then sync with server in the background.
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete table");
    } finally {
      setDeletingId(null);
    }
  }

  if (!token) return <Navigate to="/staff/login" replace />;

  const origin = window.location.origin;

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Link to="/staff">← Back</Link>
      </div>
      {error && <div className="card muted">{error}</div>}



      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Floor</div>
          <div className="muted">
            Total seats {totals.totalSeats} · Vacant seats {totals.vacantSeats}
          </div>
        </div>
        <div className="table-grid">
          {tables.map((t) => (
            <div key={t.id} className={`table-card ${t.occupied ? 'occupied' : 'vacant'}`}>
              <div 
                onClick={() => navigate(`/staff/tables/${t.id}/serve`)}
                style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <div className="table-card-title">{t.label}</div>
                <div className="table-card-meta">
                  Seats {t.seatCapacity}
                </div>
                <div className="table-card-status">
                  {t.occupied ? (
                    <div>
                      <span className="badge occupied">Occupied</span>
                      <div className="text-xs" style={{ marginTop: 4 }}>{t.partySize} guest{t.partySize === 1 ? "" : "s"}</div>
                      <div className="text-xs muted">Vacant at table: {t.vacantSeats}</div>
                    </div>
                  ) : (
                    <span className="badge vacant">Vacant</span>
                  )}
                </div>
              </div>
              <div className="table-card-actions">
                <button
                  type="button"
                  className="primary sm"
                  onClick={(e) => { e.stopPropagation(); setSelectedQrTable(t); }}
                  style={{ width: "100%", marginBottom: 4 }}
                >
                  📱 View QR Code
                </button>
                <a href={`${origin}/t/${t.tableSlug}`} className="muted" style={{ fontSize: "0.8rem", textDecoration: "underline", display: "inline-block", marginBottom: 6 }}>
                  Guest link
                </a>
                {t.occupied && (
                  <button type="button" className="amber sm" onClick={() => closeSession(t.id)} style={{ width: "100%", marginTop: 4 }}>
                    Close session
                  </button>
                )}
                <button
                  type="button"
                  className="danger sm"
                  disabled={deletingId === t.id}
                  title="Permanently delete this table"
                  onClick={(e) => { e.stopPropagation(); deleteTable(t); }}
                  style={{
                    width: "100%",
                    marginTop: 4,
                    opacity: deletingId === t.id ? 0.45 : 1,
                    cursor: deletingId === t.id ? "not-allowed" : "pointer",
                  }}
                >
                  {deletingId === t.id ? "Deleting…" : "Delete table"}
                </button>
              </div>
            </div>
          ))}
          {tables.length === 0 && <div className="muted">No active tables. Create one below.</div>}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Add custom table</div>
        <form onSubmit={createTable} className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Patio 4)"
            style={{ flex: 1, minWidth: 140 }}
            required
          />
          <input
            type="number"
            min={1}
            max={99}
            value={newSeats}
            onChange={(e) => setNewSeats(Number(e.target.value))}
            title="Seat capacity"
            style={{ width: 72 }}
          />
          <button className="primary" type="submit">
            Create
          </button>
        </form>
        {createdSlug && (
          <div className="muted" style={{ marginTop: 10 }}>
            Guest link:{" "}
            <a href={`${origin}/t/${createdSlug}`}>
              {origin}/t/{createdSlug}
            </a>
          </div>
        )}
      </div>

      {selectedQrTable && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(5, 7, 10, 0.85)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }} onClick={() => setSelectedQrTable(null)}>
          <div className="card" style={{
            maxWidth: "400px",
            width: "100%",
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
            border: "2px solid var(--amber)",
            boxShadow: "0 0 40px rgba(245, 158, 11, 0.15)",
            padding: "30px",
            position: "relative",
            textAlign: "center",
            marginBottom: 0
          }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedQrTable(null)} 
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                background: "rgba(255,255,255,0.05)",
                border: "none",
                borderRadius: "50%",
                width: "30px",
                height: "30px",
                color: "var(--text-2)",
                fontWeight: "bold",
                fontSize: "1.1rem",
                display: "grid",
                placeItems: "center",
                lineHeight: 1
              }}
            >
              ×
            </button>

            <div style={{ marginBottom: "15px" }}>
              <div style={{
                background: "linear-gradient(135deg, var(--amber), #ef4444)",
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                margin: "0 auto 10px",
                display: "grid",
                placeItems: "center",
                fontSize: "1.4rem",
                fontWeight: 800,
                color: "#fff",
                boxShadow: "0 0 15px var(--amber-glow)"
              }}>
                I
              </div>
              <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)" }}>Iris Cafe</h3>
              <p className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Tabletop Service Card
              </p>
            </div>

            <div style={{
              background: "#fff",
              padding: "16px",
              borderRadius: "16px",
              display: "inline-block",
              margin: "10px 0 20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=0d1117&margin=0&data=${encodeURIComponent(origin + '/t/' + selectedQrTable.tableSlug)}`}
                alt={`QR Code for ${selectedQrTable.label}`}
                style={{ width: "200px", height: "200px", display: "block" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--amber)" }}>
                {selectedQrTable.label}
              </h4>
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: "4px" }}>
                Scan to view menu & place orders
              </p>
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <button 
                className="primary" 
                onClick={() => {
                  window.open(`/t/${selectedQrTable.tableSlug}`, "_blank");
                  setSelectedQrTable(null);
                }}
                style={{ width: "100%", padding: "12px" }}
              >
                📱 Simulate Phone Scan
              </button>
              <button 
                className="amber sm" 
                onClick={() => {
                  navigator.clipboard.writeText(`${origin}/t/${selectedQrTable.tableSlug}`);
                  alert("Guest ordering link copied to clipboard!");
                }}
                style={{ width: "100%" }}
              >
                📋 Copy Table URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
