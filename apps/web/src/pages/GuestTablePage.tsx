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
    dietType?: "veg" | "egg" | "non-veg";
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

type ReviewItem = {
  id: string;
  menuItemId: string;
  name: string;
  rating: number;
};

type Review = {
  id: string;
  reviewerName: string;
  overallRating: number;
  comment: string;
  feedbackType: "comment" | "suggestion" | "complaint";
  createdAt: string;
  menuItemReviews: ReviewItem[];
};

type StatsResponse = {
  overallAverage: number;
  totalReviewsCount: number;
  itemAverages: Record<string, { average: number; count: number }>;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    cents / 100,
  );
}

function StarRatingSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{
            cursor: "pointer",
            fontSize: "1.6rem",
            color: star <= (hoverValue ?? value) ? "var(--amber)" : "rgba(255,255,255,0.15)",
            textShadow: star <= (hoverValue ?? value) ? "0 0 10px rgba(245,158,11,0.4)" : "none",
            transition: "all 0.15s ease",
          }}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(null)}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function renderDietSymbol(type?: "veg" | "egg" | "non-veg") {
  const color = type === "veg" || !type ? "#10b981" : type === "egg" ? "#f59e0b" : "#ef4444";
  const bg = type === "veg" || !type ? "rgba(16, 185, 129, 0.05)" : type === "egg" ? "rgba(245, 158, 11, 0.05)" : "rgba(239, 68, 68, 0.05)";
  const title = type === "veg" || !type ? "Pure Veg" : type === "egg" ? "Contains Egg (Veg+Egg)" : "Non-Veg";

  return (
    <span
      title={title}
      style={{
        border: `1.5px solid ${color}`,
        width: "12px",
        height: "12px",
        padding: "1px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "2px",
        background: bg,
        flexShrink: 0,
        marginRight: "4px"
      }}
    >
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color }} />
    </span>
  );
}

export function GuestTablePage() {
  const { tableSlug } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [booting, setBooting] = useState(true);

  // Tab and Reviews state
  const [activeTab, setActiveTab] = useState<'menu' | 'reviews'>('menu');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Post Review Form state
  const [showForm, setShowForm] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [overallRating, setOverallRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedbackType, setFeedbackType] = useState<"comment" | "suggestion" | "complaint">("comment");
  const [itemReviews, setItemReviews] = useState<{ menuItemId: string; rating: number }[]>([]);
  
  // Specific dish selection in form
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [selectedItemRating, setSelectedItemRating] = useState(5);

  const [submittingReview, setSubmittingReview] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [allOrders, setAllOrders] = useState<OrderResponse[]>([]);
  const [isSettling, setIsSettling] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  async function handleSettleUpBill() {
    if (!window.confirm("Are you sure you want to settle up your bill and complete checkout?")) return;
    setError(null);
    setIsSettling(true);
    try {
      await apiJson("/api/guest/settle", { method: "POST" });
      setCheckoutComplete(true);
      setTimeout(() => {
        window.location.reload();
      }, 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not settle bill");
      setIsSettling(false);
    }
  }

  function handlePrintBill() {
    const placedOrders = allOrders.filter((o) => o.status !== "draft");
    if (placedOrders.length === 0) return;

    const consolidatedLinesMap = new Map<string, { name: string; unitPriceCents: number; quantity: number }>();
    for (const ord of placedOrders) {
      for (const line of ord.lines) {
        const key = line.name;
        const existing = consolidatedLinesMap.get(key);
        if (existing) {
          existing.quantity += line.quantity;
        } else {
          consolidatedLinesMap.set(key, {
            name: line.name,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
          });
        }
      }
    }

    const linesList = Array.from(consolidatedLinesMap.values());
    const subtotalCents = linesList.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
    const taxCents = Math.round(subtotalCents * 0.05);
    const totalCents = subtotalCents + taxCents;

    const linesHtml = linesList.map(l => `
      <tr>
        <td style="padding: 6px 0; border-bottom: 1px dashed #eee;">${l.name} x${l.quantity}</td>
        <td style="text-align: right; padding: 6px 0; border-bottom: 1px dashed #eee;">${formatMoney(l.unitPriceCents * l.quantity)}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Iris Cafe - Customer Receipt</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 30px; color: #000; max-width: 400px; margin: 0 auto; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 25px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
            .header p { margin: 4px 0; font-size: 13px; color: #333; }
            .separator { border-top: 1px dashed #000; margin: 15px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { border-bottom: 1px dashed #000; text-align: left; padding-bottom: 6px; font-weight: bold; }
            .totals { border-top: 1px dashed #000; padding-top: 10px; }
            .totals-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .grand-total { font-weight: bold; font-size: 1.25em; border-top: 1px dashed #000; padding-top: 8px; margin-top: 6px; }
            .footer { text-align: center; margin-top: 35px; font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>IRIS CAFE</h1>
            <p>Customer Bill Summary</p>
            <div class="separator"></div>
            <p>Date: ${new Date().toLocaleString()}</p>
            <p>Table Slug: ${tableSlug}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item Description</th>
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
              <span>GST Tax (5%):</span>
              <span>${formatMoney(taxCents)}</span>
            </div>
            <div class="totals-row grand-total">
              <span>Total:</span>
              <span>${formatMoney(totalCents)}</span>
            </div>
          </div>

          <div class="footer">
            Thank you for dining with us!<br/>
            Have a wonderful day!
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 300); }
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

  async function refreshOrder() {
    try {
      const o = await apiJson<OrderResponse>("/api/guest/order");
      setOrder(o);
    } catch (e) {
      console.error("Failed to load draft order:", e);
    }
    try {
      const list = await apiJson<OrderResponse[]>("/api/guest/orders/all");
      setAllOrders(list);
    } catch (e) {
      console.error("Failed to load all orders:", e);
    }
  }

  async function fetchReviewsData() {
    setLoadingReviews(true);
    try {
      const revList = await apiJson<Review[]>("/api/guest/reviews");
      setReviews(revList);
      const statData = await apiJson<StatsResponse>("/api/guest/reviews/stats");
      setStats(statData);
    } catch (e) {
      console.error("Failed to load reviews:", e);
    } finally {
      setLoadingReviews(false);
    }
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
        if (!cancelled) {
          setMenu(m);
          if (m.items.length > 0) {
            setSelectedMenuItemId(m.items[0].id);
          }
        }
        await refreshOrder();
        await fetchReviewsData();
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

  useEffect(() => {
    if (!tableSlug) return;
    const timer = setInterval(() => {
      refreshOrder();
    }, 10000); // Poll kitchen order changes every 10 seconds
    return () => clearInterval(timer);
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

  function addItemRating() {
    if (!selectedMenuItemId) return;
    // Check if already rated in this draft
    if (itemReviews.some((r) => r.menuItemId === selectedMenuItemId)) {
      alert("You have already added a rating for this item. Remove it first to re-rate.");
      return;
    }
    setItemReviews([...itemReviews, { menuItemId: selectedMenuItemId, rating: selectedItemRating }]);
    setSelectedItemRating(5);
  }

  function removeItemRating(menuItemId: string) {
    setItemReviews(itemReviews.filter((r) => r.menuItemId !== menuItemId));
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingReview(true);
    setError(null);
    setSubmitSuccess(null);

    try {
      await apiJson("/api/guest/reviews", {
        method: "POST",
        json: {
          reviewerName,
          overallRating,
          comment,
          feedbackType,
          menuItemReviews: itemReviews,
        },
      });

      setSubmitSuccess("Thank you! Your feedback has been submitted successfully and will be published after quick moderation.");
      
      // Reset form
      setReviewerName("");
      setOverallRating(5);
      setComment("");
      setFeedbackType("comment");
      setItemReviews([]);
      setShowForm(false);
      
      // Refresh stats/reviews
      await fetchReviewsData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  }

  function renderStars(rating: number) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return (
      <span style={{ color: "var(--amber)", fontSize: "0.9rem" }}>
        {"★".repeat(full)}
        {half && "½"}
        {"☆".repeat(empty)}
      </span>
    );
  }

  if (!tableSlug) return <div className="card">Missing table</div>;
  if (booting) return <div className="card muted">Loading menu…</div>;

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Iris Cafe</div>
            <div className="muted">Table Slug: {tableSlug}</div>
          </div>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

        {/* Guest Tab Navigation */}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
          <button
            className={activeTab === "menu" ? "primary sm" : "sm"}
            onClick={() => setActiveTab("menu")}
            style={{ flex: 1 }}
          >
            🍽️ Browse Menu
          </button>
          <button
            className={activeTab === "reviews" ? "primary sm" : "sm"}
            onClick={() => setActiveTab("reviews")}
            style={{ flex: 1, display: "flex", gap: "5px", justifyContent: "center", alignItems: "center" }}
          >
            ⭐ Reviews & Feedback
            {stats && stats.totalReviewsCount > 0 && (
              <span style={{ background: "rgba(255,255,255,0.15)", fontSize: "0.75rem", borderRadius: "50%", padding: "1px 6px" }}>
                {stats.totalReviewsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === "menu" ? (
        <div>
          {menu?.categories.map((c) => {
            const categoryItems = itemsByCategory.get(c.id) ?? [];
            if (categoryItems.length === 0) return null; // Skip unused menu categories!
            
            return (
              <div key={c.id} className="card">
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "1.1rem", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>{c.name}</div>
                <div style={{ display: "grid", gap: 14 }}>
                  {categoryItems.map((i) => {
                    const ratingInfo = stats?.itemAverages?.[i.id];
                    return (
                      <div key={i.id} className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <div style={{ flex: 1, paddingRight: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {renderDietSymbol(i.dietType)}
                              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{i.name}</span>
                            </div>
                            {ratingInfo && (
                              <span className="badge" style={{ background: "var(--amber-dim)", borderColor: "rgba(245,158,11,0.2)", color: "#fcd34d", fontSize: "0.68rem", padding: "1px 6px" }}>
                                ★ {ratingInfo.average.toFixed(1)} ({ratingInfo.count})
                              </span>
                            )}
                          </div>
                          {i.description && <div className="muted" style={{ fontSize: "0.8rem", marginTop: "2px" }}>{i.description}</div>}
                          <div style={{ fontWeight: 700, color: "var(--amber)", fontSize: "0.85rem", marginTop: "4px" }}>{formatMoney(i.priceCents)}</div>
                        </div>
                        <button
                          className="primary sm"
                          type="button"
                          onClick={() => addItem(i.id)}
                          disabled={order?.status !== "draft"}
                          style={{ marginTop: "4px" }}
                        >
                          Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Cart Card */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Your order</div>
            {!order || order.lines.length === 0 ? (
              <div className="muted">No items yet. Add some delicious dishes!</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {order.lines.map((l) => (
                  <div key={l.id} className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {l.name} × {l.quantity}
                      </div>
                      {l.note && <div className="muted" style={{ fontSize: "0.75rem" }}>{l.note}</div>}
                    </div>
                    <div className="muted">{formatMoney(l.unitPriceCents * l.quantity)}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <button
                className="primary lg"
                type="button"
                onClick={placeOrder}
                disabled={!order || order.status !== "draft" || order.lines.length === 0}
                style={{ width: "100%" }}
              >
                Send to kitchen ({formatMoney(order?.lines.reduce((acc, l) => acc + l.unitPriceCents * l.quantity, 0) || 0)})
              </button>
            </div>
          </div>

          {/* Placed / Sent Orders Card */}
          {allOrders.filter((o) => o.status !== "draft").length > 0 && (
            <div className="card animate-in">
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "1rem" }}>
                Sent Orders (Active Kitchen Orders)
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                {allOrders
                  .filter((o) => o.status !== "draft")
                  .map((o) => (
                    <div key={o.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-3)", fontWeight: 600 }}>
                          Order #{o.id.substring(o.id.length - 6)}
                        </span>
                        <span
                          className={`badge ${o.status}`}
                          style={{
                            fontSize: "0.68rem",
                            textTransform: "uppercase",
                            padding: "2px 8px",
                          }}
                        >
                          {o.status}
                        </span>
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {o.lines.map((l) => (
                          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                            <span className="muted">{l.name} × {l.quantity}</span>
                            <span className="muted">{formatMoney(l.unitPriceCents * l.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Settle Up & Check Out Card */}
          {(() => {
            const placedOrders = allOrders.filter((o) => o.status !== "draft");
            if (placedOrders.length === 0) return null;

            // Calculate overall sum
            let overallSubtotalCents = 0;
            for (const ord of placedOrders) {
              overallSubtotalCents += ord.lines.reduce((acc, l) => acc + l.unitPriceCents * l.quantity, 0);
            }
            const overallTaxCents = Math.round(overallSubtotalCents * 0.05);
            const overallTotalCents = overallSubtotalCents + overallTaxCents;

            return (
              <div className="card animate-in" style={{ border: "2px solid var(--green)", boxShadow: "0 0 20px rgba(16, 185, 129, 0.15)", marginTop: "16px" }}>
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "1.1rem", color: "var(--green)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>💳</span> Settle Up & Checkout
                </div>
                <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "16px" }}>
                  Ready to leave? Review your final table summary below and pay directly from here.
                </p>

                <div style={{ display: "grid", gap: "8px", fontSize: "0.9rem", marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Items Subtotal:</span>
                    <span style={{ fontWeight: "600" }}>{formatMoney(overallSubtotalCents)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">GST Tax (5%):</span>
                    <span style={{ fontWeight: "600" }}>{formatMoney(overallTaxCents)}</span>
                  </div>
                  <div className="divider" style={{ margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontWeight: "700", fontSize: "1.05rem" }}>Total Bill:</span>
                    <span style={{ fontWeight: "800", fontSize: "1.3rem", color: "var(--amber)" }}>{formatMoney(overallTotalCents)}</span>
                  </div>
                </div>

                {isSettling ? (
                  <div style={{ textAlign: "center", padding: "10px" }}>
                    <div className="spinner" style={{ margin: "0 auto 8px" }}></div>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>Processing checkout transaction...</div>
                  </div>
                ) : checkoutComplete ? (
                  <div style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid var(--green)",
                    padding: "16px",
                    borderRadius: "12px",
                    textAlign: "center"
                  }}>
                    <span style={{ fontSize: "1.8rem", display: "block", marginBottom: "4px" }}>🎉</span>
                    <h4 style={{ color: "var(--green)", fontWeight: "700", margin: "0 0 4px" }}>Settle up complete!</h4>
                    <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                      Thank you for dining with Iris Cafe! Have a fantastic day ahead.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    <button
                      className="primary lg"
                      type="button"
                      onClick={handlePrintBill}
                      style={{ width: "100%", height: "46px", fontSize: "1rem", fontWeight: "700", background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                    >
                      🧾 View & Print Bill
                    </button>
                    <button
                      className="success lg"
                      type="button"
                      onClick={handleSettleUpBill}
                      style={{ width: "100%", height: "46px", fontSize: "1rem", fontWeight: "700" }}
                    >
                      💸 Settle & Pay Bill
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        /* Reviews and Feedback Tab */
        <div>
          {submitSuccess && <div className="alert alert-success" style={{ marginBottom: "16px" }}>{submitSuccess}</div>}

          {/* Rating Summary Card */}
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Overall Café Experience
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "4px" }}>
                <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--amber)" }}>
                  {stats?.overallAverage ? stats.overallAverage.toFixed(1) : "0.0"}
                </span>
                <div>
                  <div>{stats?.overallAverage ? renderStars(stats.overallAverage) : renderStars(0)}</div>
                  <span className="muted" style={{ fontSize: "0.78rem" }}>
                    Based on {stats?.totalReviewsCount || 0} reviews
                  </span>
                </div>
              </div>
            </div>

            <button className="primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? "✕ Cancel" : "✍️ Write a Review"}
            </button>
          </div>

          {/* Review Submission Form (Expandable) */}
          {showForm && (
            <form onSubmit={handleSubmitReview} className="card animate-in">
              <div style={{ fontWeight: 700, marginBottom: "16px", fontSize: "1.05rem", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                Share your Café Experience
              </div>

              {/* Reviewer Name */}
              <div className="form-group">
                <label>Your Name / Nickname</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul S. (or leave blank for Anonymous)"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Feedback type selector */}
              <div className="form-group">
                <label>Type of Feedback</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["comment", "suggestion", "complaint"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`sm ${feedbackType === type ? "primary" : ""}`}
                      onClick={() => setFeedbackType(type)}
                      style={{ flex: 1, textTransform: "capitalize" }}
                    >
                      {type === "comment" ? "💬 Comment" : type === "suggestion" ? "💡 Suggestion" : "⚠️ Complaint"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cafe Experience Rating */}
              <div className="form-group" style={{ margin: "20px 0" }}>
                <label>Overall Cafe Rating</label>
                <StarRatingSelector value={overallRating} onChange={(val) => setOverallRating(val)} />
              </div>

              {/* Rate Specific Dishes (Optional) */}
              {menu && menu.items.length > 0 && (
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: "18px" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "8px" }}>
                    Rate Specific Dishes / Drinks (Optional)
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={selectedMenuItemId}
                      onChange={(e) => setSelectedMenuItemId(e.target.value)}
                      style={{ flex: 1, minWidth: "150px" }}
                    >
                      {menu.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <div style={{ width: "120px", display: "flex", justifyContent: "center" }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          style={{
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            color: star <= selectedItemRating ? "var(--amber)" : "rgba(255,255,255,0.15)",
                          }}
                          onClick={() => setSelectedItemRating(star)}
                        >
                          ★
                        </span>
                      ))}
                    </div>

                    <button type="button" className="success sm" onClick={addItemRating}>
                      + Add
                    </button>
                  </div>

                  {/* List of currently rated items */}
                  {itemReviews.length > 0 && (
                    <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "8px", display: "grid", gap: "6px" }}>
                      {itemReviews.map((ir) => {
                        const itemObj = menu.items.find((x) => x.id === ir.menuItemId);
                        return (
                          <div key={ir.menuItemId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-2)", padding: "4px 10px", borderRadius: "4px" }}>
                            <span style={{ fontSize: "0.8rem" }}>🍽️ {itemObj?.name}</span>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <span style={{ fontSize: "0.8rem", color: "var(--amber)" }}>{"★".repeat(ir.rating)}</span>
                              <button
                                type="button"
                                className="danger sm"
                                onClick={() => removeItemRating(ir.menuItemId)}
                                style={{ padding: "1px 6px", fontSize: "0.7rem", borderRadius: "3px" }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Review Comment Text */}
              <div className="form-group">
                <label>Review details / suggestions / complaints</label>
                <textarea
                  rows={4}
                  placeholder="Share your honest feedback. What did you enjoy? What could we improve?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                />
              </div>

              <button type="submit" className="primary lg" style={{ width: "100%", marginTop: "8px" }} disabled={submittingReview}>
                {submittingReview ? "Submitting Review…" : "Submit Review"}
              </button>
            </form>
          )}

          {/* Approved Reviews Timeline list */}
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
            Recent Customer Reviews
          </div>

          {loadingReviews ? (
            <div className="card muted" style={{ display: "flex", justifyContent: "center", padding: "30px" }}>
              <div className="spinner" style={{ marginRight: "10px" }} /> Loading reviews…
            </div>
          ) : reviews.length === 0 ? (
            <div className="card muted" style={{ textAlign: "center", padding: "30px" }}>
              No published reviews yet. Be the first to share your thoughts!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {reviews.map((rev) => (
                <div key={rev.id} className="card animate-in" style={{ padding: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "8px" }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{rev.reviewerName}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-3)", marginLeft: "8px" }}>
                        • {new Date(rev.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <span
                      className="badge"
                      style={{
                        background:
                          rev.feedbackType === "complaint"
                            ? "var(--red-dim)"
                            : rev.feedbackType === "suggestion"
                            ? "var(--amber-dim)"
                            : "var(--blue-dim)",
                        borderColor:
                          rev.feedbackType === "complaint"
                            ? "rgba(239, 68, 68, 0.2)"
                            : rev.feedbackType === "suggestion"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(59, 130, 246, 0.2)",
                        color:
                          rev.feedbackType === "complaint"
                            ? "#fca5a5"
                            : rev.feedbackType === "suggestion"
                            ? "#fcd34d"
                            : "#93c5fd",
                        fontSize: "0.68rem",
                      }}
                    >
                      {rev.feedbackType}
                    </span>
                  </div>

                  {/* Stars experience */}
                  <div style={{ marginBottom: "8px" }}>{renderStars(rev.overallRating)}</div>

                  {/* Comment */}
                  {rev.comment && (
                    <div style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.4, margin: "8px 0" }}>
                      "{rev.comment}"
                    </div>
                  )}

                  {/* Rated items list */}
                  {rev.menuItemReviews && rev.menuItemReviews.length > 0 && (
                    <div style={{ marginTop: "10px", padding: "6px 10px", background: "var(--surface-2)", borderRadius: "4px" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "4px" }}>
                        Rated Items
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                        {rev.menuItemReviews.map((ir) => (
                          <div key={ir.id} style={{ fontSize: "0.78rem", display: "flex", gap: "6px" }}>
                            <span className="muted">🍽️ {ir.name}</span>
                            <span style={{ color: "var(--amber)" }}>{"★".repeat(ir.rating)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
