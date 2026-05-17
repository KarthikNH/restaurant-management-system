import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { apiJson } from "../api";

type TableDetail = {
  id: string;
  label: string;
  tableSlug: string;
  seatCapacity: number;
  occupied: boolean;
  partySize: number;
  vacantSeats: number;
};

type MenuResponse = {
  categories: { id: string; name: string; sortOrder: number }[];
  items: {
    id: string;
    categoryId: string;
    name: string;
    description: string;
    priceCents: number;
  }[];
};

type OrderResponse = {
  id: string;
  status: string;
  lines: {
    id: string;
    name: string;
    unitPriceCents: number;
    quantity: number;
    note: string;
  }[];
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    cents / 100,
  );
}

export function StaffTableServePage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("staff_token");
  const [detail, setDetail] = useState<TableDetail | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [menuReady, setMenuReady] = useState(false);
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [showQr, setShowQr] = useState(false);

  const refreshOrder = useCallback(async () => {
    if (!tableId) return;
    const o = await apiJson<OrderResponse>(`/api/staff/tables/${tableId}/order`);
    setOrder(o);
  }, [tableId]);

  const loadDetail = useCallback(async () => {
    if (!tableId) return;
    const d = await apiJson<TableDetail>(`/api/staff/tables/${tableId}`);
    setDetail(d);
    if (d.occupied) setMenuReady(true);
    else setMenuReady(false);
  }, [tableId]);

  useEffect(() => {
    if (!token || !tableId) return;
    let cancelled = false;
    (async () => {
      setBooting(true);
      setError(null);
      try {
        await loadDetail();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, tableId, loadDetail]);

  useEffect(() => {
    if (!token || !tableId || !menuReady) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const m = await apiJson<MenuResponse>(`/api/staff/tables/${tableId}/menu`);
        if (!cancelled) setMenu(m);
        await refreshOrder();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load menu");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, tableId, menuReady, refreshOrder]);

  const itemsByCategory = useMemo(() => {
    if (!menu) return new Map<string, MenuResponse["items"]>();
    const map = new Map<string, MenuResponse["items"]>();
    for (const item of menu.items) {
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [menu]);

  async function startSession(e: React.FormEvent) {
    e.preventDefault();
    if (!tableId) return;
    setError(null);
    try {
      await apiJson(`/api/staff/tables/${tableId}/session`, {
        method: "POST",
        json: { partySize },
      });
      setMenuReady(true);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
    }
  }

  async function addItem(menuItemId: string) {
    if (!tableId) return;
    setError(null);
    try {
      await apiJson(`/api/staff/tables/${tableId}/order/items`, {
        method: "POST",
        json: { menuItemId, quantity: 1 },
      });
      await refreshOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    }
  }

  async function placeOrder() {
    if (!tableId) return;
    setError(null);
    try {
      await apiJson(`/api/staff/tables/${tableId}/order/place`, { method: "POST" });
      navigate("/staff/tables");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place order");
    }
  }

  if (!token) return <Navigate to="/staff/login" replace />;
  if (!tableId) return <div className="card">Missing table</div>;
  if (booting && !detail) return <div className="card muted">Loading…</div>;

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Link to="/staff/tables">← Tables</Link>
      </div>
      {error && <div className="card muted">{error}</div>}

      {detail && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{detail.label}</div>
              <div className="muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
                Capacity {detail.seatCapacity} · Party {detail.partySize || "—"} · Slug: {detail.tableSlug}
              </div>
            </div>
            <button
              type="button"
              className="primary sm"
              onClick={() => setShowQr(true)}
              style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
            >
              📱 Show QR Code
            </button>
          </div>
        </div>
      )}

      {showQr && detail && (
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
        }} onClick={() => setShowQr(false)}>
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
              onClick={() => setShowQr(false)} 
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
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=0d1117&margin=0&data=${encodeURIComponent(window.location.origin + '/t/' + detail.tableSlug)}`}
                alt={`QR Code for ${detail.label}`}
                style={{ width: "200px", height: "200px", display: "block" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--amber)" }}>
                {detail.label}
              </h4>
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: "4px" }}>
                Scan to view menu & place orders
              </p>
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <button 
                className="primary" 
                onClick={() => {
                  window.open(`/t/${detail.tableSlug}`, "_blank");
                  setShowQr(false);
                }}
                style={{ width: "100%", padding: "12px" }}
              >
                📱 Simulate Phone Scan
              </button>
              <button 
                className="amber sm" 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/t/${detail.tableSlug}`);
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

      {!menuReady && detail && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>How many guests?</div>
          <form onSubmit={startSession} className="row" style={{ flexWrap: "wrap" }}>
            <input
              type="number"
              min={1}
              max={detail.seatCapacity}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              style={{ width: 100 }}
            />
            <button className="primary" type="submit">
              Open menu
            </button>
          </form>
          <div className="muted" style={{ marginTop: 8 }}>
            Maximum party size for this table is {detail.seatCapacity}.
          </div>
        </div>
      )}

      {menuReady && menu && (
        <>
          {menu.categories.map((c) => (
            <div key={c.id} className="card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{c.name}</div>
              <div style={{ display: "grid", gap: 10 }}>
                {(itemsByCategory.get(c.id) ?? []).map((i) => (
                  <div key={i.id} className="row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{i.name}</div>
                      {i.description && <div className="muted">{i.description}</div>}
                      <div className="muted">{formatMoney(i.priceCents)}</div>
                    </div>
                    <button
                      className="primary"
                      type="button"
                      onClick={() => addItem(i.id)}
                      disabled={order?.status !== "draft"}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Current ticket</div>
            {!order || order.lines.length === 0 ? (
              <div className="muted">No items yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {order.lines.map((l) => (
                  <div key={l.id} className="row">
                    <div>
                      <div>
                        {l.name} × {l.quantity}
                      </div>
                      {l.note && <div className="muted">{l.note}</div>}
                    </div>
                    <div className="muted">{formatMoney(l.unitPriceCents * l.quantity)}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }} className="row">
              <button
                className="primary"
                type="button"
                onClick={placeOrder}
                disabled={!order || order.status !== "draft" || order.lines.length === 0}
              >
                Send to kitchen
              </button>
              <Link to="/staff/tables">Cancel</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
