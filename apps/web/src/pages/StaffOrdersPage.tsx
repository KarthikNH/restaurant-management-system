import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiJson } from "../api";

type OrderRow = {
  id: string;
  status: string;
  tableLabel: string;
  tableSlug?: string;
  lineCount: number;
};

type OrderDetail = {
  id: string;
  status: string;
  table: { label: string; tableSlug: string } | null;
  lines: { id: string; name: string; unitPriceCents: number; quantity: number; note: string }[];
};

const statuses = ["draft", "placed", "confirmed", "closed"] as const;

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    cents / 100,
  );
}

export function StaffOrdersPage() {
  const token = localStorage.getItem("staff_token");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const list = await apiJson<OrderRow[]>("/api/staff/orders");
    setOrders(list);
  }

  useEffect(() => {
    if (!token) return;
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [token]);

  async function openOrder(id: string) {
    setError(null);
    const o = await apiJson<OrderDetail>(`/api/staff/orders/${id}`);
    setSelected(o);
  }

  async function setStatus(id: string, status: (typeof statuses)[number]) {
    setError(null);
    await apiJson(`/api/staff/orders/${id}/status`, {
      method: "PATCH",
      json: { status },
    });
    await load();
    if (selected?.id === id) await openOrder(id);
  }

  async function deleteOrder(id: string) {
    if (!window.confirm("Are you sure you want to delete this order?")) return;
    setError(null);
    try {
      await apiJson(`/api/staff/orders/${id}`, { method: "DELETE" });
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete order");
    }
  }

  function printBill(order: OrderDetail) {
    const subtotalCents = order.lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
    const taxCents = Math.round(subtotalCents * 0.05);
    const totalCents = subtotalCents + taxCents;

    const linesHtml = order.lines.map(l => `
      <tr>
        <td style="padding: 4px 0;">${l.name} x${l.quantity}</td>
        <td style="text-align: right; padding: 4px 0;">${formatMoney(l.unitPriceCents * l.quantity)}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Iris Cafe - Bill</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #000; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 4px 0; font-size: 14px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { border-bottom: 1px dashed #000; text-align: left; padding-bottom: 4px; }
            .totals { border-top: 1px dashed #000; padding-top: 10px; }
            .totals-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .grand-total { font-weight: bold; font-size: 1.2em; border-top: 1px dashed #000; padding-top: 8px; margin-top: 4px; }
            .footer { text-align: center; margin-top: 30px; font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Iris Cafe</h1>
            <p>Date: ${new Date().toLocaleString()}</p>
            <p>Table: ${order.table?.label ?? "?"}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>${formatMoney(subtotalCents)}</span>
            </div>
            <div class="totals-row">
              <span>Tax (5%):</span>
              <span>${formatMoney(taxCents)}</span>
            </div>
            <div class="totals-row grand-total">
              <span>Total:</span>
              <span>${formatMoney(totalCents)}</span>
            </div>
          </div>

          <div class="footer">
            Thank you for visiting!<br/>
            Please come again.
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 200); }
          </script>
        </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
    }
  }

  if (!token) return <Navigate to="/staff/login" replace />;

  return (
    <div className="fade-in">
      <div className="section-heading">
        <div className="section-heading-icon" style={{ background: "linear-gradient(135deg, var(--green), var(--blue))", boxShadow: "0 0 16px var(--green-glow)" }}>
          🧾
        </div>
        <h2 style={{ fontSize: "1.4rem" }}>Active Orders</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
        
        {/* Left Column: Orders List */}
        <div className="card no-print">
          <div className="card-title">All Tickets</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {orders.map((o) => (
              <div 
                key={o.id} 
                className="order-list-item"
                onClick={() => openOrder(o.id)}
                style={{ 
                  background: selected?.id === o.id ? "var(--surface-3)" : "transparent",
                  padding: "12px",
                  borderRadius: "var(--radius-sm)",
                  border: selected?.id === o.id ? "1px solid var(--border-hover)" : "1px solid transparent"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    {o.tableLabel} <span className="muted" style={{ fontWeight: 400 }}>· {o.lineCount} items</span>
                  </div>
                  <div className="muted mono" style={{ marginTop: 4 }}>
                    ID: {o.id.slice(-6).toUpperCase()}
                  </div>
                </div>
                <span className={`badge ${o.status}`}>{o.status}</span>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="empty">
                <div className="empty-icon">🍽️</div>
                <div className="empty-text">No active orders right now.</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Order Detail */}
        {selected ? (
          (() => {
            const subtotalCents = selected.lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
            const taxCents = Math.round(subtotalCents * 0.05); // 5% tax
            const totalCents = subtotalCents + taxCents;

            return (
              <div className="card animate-in">
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div className="card-title" style={{ marginBottom: 4 }}>Ticket Detail</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{selected.table?.label ?? "?"}</div>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} className="sm">
                    Close ✕
                  </button>
                </div>
                
                <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
                  {selected.lines.map((l) => (
                    <div key={l.id} className="row" style={{ justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{l.name}</div>
                        <div className="muted">Qty: {l.quantity}</div>
                      </div>
                      <div style={{ fontWeight: 600 }}>{formatMoney(l.unitPriceCents * l.quantity)}</div>
                    </div>
                  ))}
                </div>
                
                <div className="divider" />
                
                <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div className="muted">Subtotal</div>
                    <div>{formatMoney(subtotalCents)}</div>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div className="muted">Tax (5%)</div>
                    <div>{formatMoney(taxCents)}</div>
                  </div>
                  <div className="order-total row" style={{ justifyContent: "space-between", marginTop: 8, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
                    <div style={{ fontSize: "1.1rem" }}>Total</div>
                    <div style={{ color: "var(--amber)", fontSize: "1.2rem" }}>{formatMoney(totalCents)}</div>
                  </div>
                </div>

                <div className="card-title" style={{ marginBottom: 12 }}>Update Status</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  {statuses.map((s) => (
                    <button 
                      key={s} 
                      type="button" 
                      onClick={() => setStatus(selected.id, s)} 
                      className={selected.status === s ? "primary" : ""}
                      style={{ flex: 1, minWidth: "100px" }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="divider" />

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="success" onClick={() => printBill(selected)} style={{ flex: 1 }}>
                    🖨️ Print Receipt
                  </button>
                  {selected.status === "closed" && (
                    <button type="button" className="danger" onClick={() => deleteOrder(selected.id)}>
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="card empty" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "300px" }}>
            <div className="empty-icon">👈</div>
            <div className="empty-text">Select a ticket to view details</div>
          </div>
        )}
      </div>
    </div>
  );
}
