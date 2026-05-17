import { useEffect, useState } from "react";
import { apiJson } from "../api";

type MenuItemReview = {
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
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  menuItemReviews: MenuItemReview[];
};

type DailyTrend = {
  date: string;
  averageRating: number;
  reviewCount: number;
};

type DishAnalytic = {
  id: string;
  name: string;
  averageRating: number;
  totalReviews: number;
};

type Analytics = {
  overallAverage: number;
  totalApprovedReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  feedbackTypeBreakdown: {
    comment: number;
    suggestion: number;
    complaint: number;
  };
  dailySatisfactionTrend: DailyTrend[];
  mostLikedDishes: DishAnalytic[];
};

export function StaffReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activeTab, setActiveTab] = useState<"moderation" | "analytics">("moderation");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const revs = await apiJson<Review[]>("/api/staff/reviews");
      setReviews(revs);
      const stats = await apiJson<Analytics>("/api/staff/reviews/analytics");
      setAnalytics(stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch reviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateStatus(reviewId: string, status: "approved" | "rejected") {
    setError(null);
    setActionSuccess(null);
    try {
      await apiJson(`/api/staff/reviews/${reviewId}/status`, {
        method: "PATCH",
        json: { status },
      });
      setActionSuccess(`Review has been successfully ${status}!`);
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to update status to ${status}`);
    }
  }

  async function deleteReview(reviewId: string) {
    if (!window.confirm("Are you sure you want to permanently delete this review? This action cannot be undone.")) {
      return;
    }
    setError(null);
    setActionSuccess(null);
    try {
      await apiJson(`/api/staff/reviews/${reviewId}`, {
        method: "DELETE",
      });
      setActionSuccess("Review has been permanently deleted.");
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete review");
    }
  }

  const filteredReviews = reviews.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  function renderStars(rating: number) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);

    return (
      <span style={{ color: "var(--amber)", fontSize: "0.95rem", letterSpacing: "1px" }}>
        {"★".repeat(full)}
        {half && "½"}
        {"☆".repeat(empty)}
      </span>
    );
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div>
      <div className="section-heading">
        <div className="section-heading-icon" style={{ background: "var(--blue-dim)", color: "var(--blue)" }}>
          ⭐
        </div>
        <h2>Customer Reviews & Feedback</h2>
      </div>

      {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Main Tab Controls */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
        <button
          className={activeTab === "moderation" ? "primary" : ""}
          onClick={() => setActiveTab("moderation")}
          style={{ display: "flex", gap: "6px", alignItems: "center" }}
        >
          📥 Moderation Queue
          {reviews.filter((r) => r.status === "pending").length > 0 && (
            <span
              style={{
                background: "var(--red)",
                color: "#fff",
                fontSize: "0.7rem",
                borderRadius: "50%",
                padding: "2px 6px",
                fontWeight: "bold",
              }}
            >
              {reviews.filter((r) => r.status === "pending").length}
            </span>
          )}
        </button>
        <button
          className={activeTab === "analytics" ? "primary" : ""}
          onClick={() => setActiveTab("analytics")}
        >
          📊 Review Analytics
        </button>
      </div>

      {loading ? (
        <div className="card muted" style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
          <div className="spinner" style={{ marginRight: "10px" }} /> Loading reviews data…
        </div>
      ) : activeTab === "moderation" ? (
        <div>
          {/* Filter Bar */}
          <div className="card" style={{ padding: "14px 20px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-3)", marginRight: "8px" }}>FILTER:</span>
            {(["all", "pending", "approved", "rejected"] as const).map((opt) => (
              <button
                key={opt}
                className={`sm ${filter === opt ? "primary" : ""}`}
                onClick={() => setFilter(opt)}
                style={{ textTransform: "capitalize" }}
              >
                {opt} ({opt === "all" ? reviews.length : reviews.filter((r) => r.status === opt).length})
              </button>
            ))}
          </div>

          {filteredReviews.length === 0 ? (
            <div className="empty card">
              <div className="empty-icon">📭</div>
              <div className="empty-text">No reviews found in this filter category.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {filteredReviews.map((rev) => (
                <div key={rev.id} className="card" style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "12px" }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{rev.reviewerName}</span>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-3)", marginLeft: "10px" }}>
                        🕒 {formatDate(rev.createdAt)}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {/* Feedback Type Pill */}
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
                              ? "rgba(239, 68, 68, 0.3)"
                              : rev.feedbackType === "suggestion"
                              ? "rgba(245, 158, 11, 0.3)"
                              : "rgba(59, 130, 246, 0.3)",
                          color:
                            rev.feedbackType === "complaint"
                              ? "#fca5a5"
                              : rev.feedbackType === "suggestion"
                              ? "#fcd34d"
                              : "#93c5fd",
                          fontSize: "0.7rem",
                        }}
                      >
                        {rev.feedbackType}
                      </span>

                      {/* Status badge */}
                      <span
                        className="badge"
                        style={{
                          background:
                            rev.status === "approved"
                              ? "var(--green-dim)"
                              : rev.status === "rejected"
                              ? "var(--red-dim)"
                              : "var(--surface-3)",
                          borderColor:
                            rev.status === "approved"
                              ? "rgba(16, 185, 129, 0.3)"
                              : rev.status === "rejected"
                              ? "rgba(239, 68, 68, 0.3)"
                              : "var(--border)",
                          color:
                            rev.status === "approved"
                              ? "#6ee7b7"
                              : rev.status === "rejected"
                              ? "#fca5a5"
                              : "var(--text-2)",
                          fontSize: "0.7rem",
                        }}
                      >
                        {rev.status}
                      </span>
                    </div>
                  </div>

                  {/* Rating Block */}
                  <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-2)" }}>Cafe Experience:</span>
                    {renderStars(rev.overallRating)}
                  </div>

                  {/* Comments Block */}
                  {rev.comment && (
                    <div style={{ background: "rgba(255, 255, 255, 0.02)", borderRadius: "var(--radius-sm)", padding: "12px 16px", borderLeft: "3px solid var(--blue)", marginBottom: "14px", fontStyle: "italic", color: "var(--text-2)", fontSize: "0.95rem" }}>
                      "{rev.comment}"
                    </div>
                  )}

                  {/* Dish Reviews Block */}
                  {rev.menuItemReviews && rev.menuItemReviews.length > 0 && (
                    <div style={{ marginBottom: "16px", padding: "10px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.05em" }}>
                        Dishes / Drinks Reviewed
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
                        {rev.menuItemReviews.map((ir) => (
                          <div key={ir.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                            <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>🍽️ {ir.name}</span>
                            <span>{renderStars(ir.rating)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Moderation Buttons */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                    {rev.status !== "approved" && (
                      <button className="success sm" onClick={() => updateStatus(rev.id, "approved")}>
                        ✓ Approve Review
                      </button>
                    )}
                    {rev.status !== "rejected" && (
                      <button className="amber sm" onClick={() => updateStatus(rev.id, "rejected")}>
                        ✗ Reject Review
                      </button>
                    )}
                    <button className="danger sm" onClick={() => deleteReview(rev.id)}>
                      🗑 Permanent Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Analytics Dashboard Tab */
        <div>
          {analytics ? (
            <div>
              {/* Top Widgets Grid */}
              <div className="stat-grid">
                <div className="stat-tile">
                  <div className="stat-tile-value" style={{ color: "var(--amber)", textShadow: "0 0 15px var(--amber-glow)" }}>
                    {analytics.overallAverage.toFixed(1)} ⭐
                  </div>
                  <div className="stat-tile-label">Average Satisfaction</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-value" style={{ color: "var(--blue)" }}>
                    {analytics.totalApprovedReviews}
                  </div>
                  <div className="stat-tile-label">Approved Reviews</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-value" style={{ color: "var(--green)" }}>
                    {analytics.mostLikedDishes.length}
                  </div>
                  <div className="stat-tile-label">Rated Menu Items</div>
                </div>
              </div>

              {/* Distributions Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                {/* Rating Stars Distribution */}
                <div className="card">
                  <div className="card-title">Rating Distribution</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {([5, 4, 3, 2, 1] as const).map((stars) => {
                      const count = analytics.ratingDistribution[stars] || 0;
                      const pct = analytics.totalApprovedReviews > 0 ? (count / analytics.totalApprovedReviews) * 100 : 0;
                      return (
                        <div key={stars} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ width: "50px", fontSize: "0.85rem", color: "var(--text-2)" }}>{stars} Star</span>
                          <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                            <div
                              style={{
                                background: "linear-gradient(90deg, var(--amber), #fb7185)",
                                width: `${pct}%`,
                                height: "100%",
                                borderRadius: "4px",
                              }}
                            />
                          </div>
                          <span style={{ width: "35px", fontSize: "0.85rem", textAlign: "right", fontWeight: "bold" }}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback Type Proportion */}
                <div className="card">
                  <div className="card-title">Feedback Categories Breakdown</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {(["comment", "suggestion", "complaint"] as const).map((type) => {
                      const count = analytics.feedbackTypeBreakdown[type] || 0;
                      const pct = analytics.totalApprovedReviews > 0 ? (count / analytics.totalApprovedReviews) * 100 : 0;
                      const color = type === "complaint" ? "var(--red)" : type === "suggestion" ? "var(--amber)" : "var(--blue)";
                      return (
                        <div key={type} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                            <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{type}s</span>
                            <span className="muted">{count} reviews ({pct.toFixed(0)}%)</span>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.05)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                            <div
                              style={{
                                background: color,
                                width: `${pct}%`,
                                height: "100%",
                                borderRadius: "4px",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Satisfaction Trends Over Time (Chronological list timeline) */}
              <div className="card">
                <div className="card-title">Customer Satisfaction Trend Over Time</div>
                {analytics.dailySatisfactionTrend.length === 0 ? (
                  <div className="muted">No historical review trends data available yet.</div>
                ) : (
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", height: "120px", padding: "10px 0", overflowX: "auto", borderBottom: "1px solid var(--border)" }}>
                    {analytics.dailySatisfactionTrend.map((trend) => {
                      const heightPct = (trend.averageRating / 5) * 100;
                      return (
                        <div key={trend.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "1", minWidth: "60px", gap: "6px" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--amber)" }}>
                            {trend.averageRating.toFixed(1)}
                          </span>
                          <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", height: "60px", borderRadius: "4px", display: "flex", alignItems: "flex-end" }}>
                            <div
                              style={{
                                width: "100%",
                                background: "linear-gradient(to top, var(--blue), var(--green))",
                                height: `${heightPct}%`,
                                borderRadius: "4px",
                                position: "relative",
                                boxShadow: "0 0 10px rgba(59, 130, 246, 0.4)",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "0.68rem", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                            {trend.date.substring(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ marginTop: "12px", fontSize: "0.78rem", color: "var(--text-3)" }}>
                  💡 Trends chart showcases daily overall experience rating averages from approved guest reviews.
                </div>
              </div>

              {/* Ranked Dishes Panel */}
              <div className="card">
                <div className="card-title">🍽️ Menu Item Reviews & Most Liked Dishes</div>
                {analytics.mostLikedDishes.length === 0 ? (
                  <div className="muted" style={{ padding: "10px" }}>No dishes rated by customers yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {analytics.mostLikedDishes.map((dish, idx) => (
                      <div key={dish.id} className="row" style={{ justifyContent: "space-between", borderBottom: idx < analytics.mostLikedDishes.length - 1 ? "1px solid var(--border)" : "none", paddingBottom: "10px" }}>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <span style={{ background: idx === 0 ? "var(--amber-dim)" : "var(--surface-3)", color: idx === 0 ? "var(--amber)" : "var(--text-2)", border: "1px solid var(--border)", borderRadius: "50%", width: "28px", height: "28px", display: "grid", placeItems: "center", fontWeight: "bold", fontSize: "0.85rem" }}>
                            #{idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{dish.name}</div>
                            <div className="muted" style={{ fontSize: "0.78rem" }}>{dish.totalReviews} reviews received</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontSize: "1rem", fontWeight: "bold", color: "var(--text)" }}>{dish.averageRating.toFixed(1)}</span>
                          {renderStars(dish.averageRating)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="muted">No analytics data available yet. Please approve some reviews first.</div>
          )}
        </div>
      )}
    </div>
  );
}
