import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiJson } from "../api";

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

export function GuestTablePage() {
  const { tableSlug } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [booting, setBooting] = useState(true);

  async function refreshOrder() {
    const o = await apiJson<OrderResponse>("/api/guest/order");
    setOrder(o);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tableSlug) return;
      setBooting(true);
      setError(null);
      try {
        await apiJson("/api/guest/sessions", {
          method: "POST",
          json: { tableSlug },
        });
        const m = await apiJson<MenuResponse>("/api/guest/menu");
        if (!cancelled) setMenu(m);
        await refreshOrder();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableSlug]);

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

  async function addItem(menuItemId: string) {
    setError(null);
    try {
      await apiJson("/api/guest/order/items", {
        method: "POST",
        json: { menuItemId, quantity: 1 },
      });
      await refreshOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add item");
    }
  }

  async function placeOrder() {
    setError(null);
    try {
      await apiJson("/api/guest/order/place", { method: "POST" });
      await refreshOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place order");
    }
  }

  if (!tableSlug) return <div className="card">Missing table</div>;
  if (booting) return <div className="card muted">Loading menu…</div>;

  return (
    <div>
      <div className="card">
        <div className="row">
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Table menu</div>
            <div className="muted">Slug: {tableSlug}</div>
          </div>
          {order && <span className="badge">Order: {order.status}</span>}
        </div>
        {error && <div className="muted" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      {menu?.categories.map((c) => (
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
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Your order</div>
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
        <div style={{ marginTop: 12 }}>
          <button
            className="primary"
            type="button"
            onClick={placeOrder}
            disabled={!order || order.status !== "draft" || order.lines.length === 0}
          >
            Send to kitchen
          </button>
        </div>
      </div>
    </div>
  );
}
