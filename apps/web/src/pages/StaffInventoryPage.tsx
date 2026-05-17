import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiJson } from "../api";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minimumThreshold: number;
  status: "healthy" | "spoiled";
};

const CATEGORIES = [
  "All",
  "Coffee",
  "Breakfast",
  "Sandwich & Burger",
  "Pasta & Pizza",
  "Shakes & Refreshers",
  "Dessert",
];

export function StaffInventoryPage() {
  const token = localStorage.getItem("staff_token");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Add new item state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Coffee");
  const [unit, setUnit] = useState("Kg");
  const [quantity, setQuantity] = useState(10);
  const [minThreshold, setMinThreshold] = useState(5);
  const [status, setStatus] = useState<"healthy" | "spoiled">("healthy");
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editMinThreshold, setEditMinThreshold] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<"healthy" | "spoiled">("healthy");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await apiJson<InventoryItem[]>("/api/staff/inventory/items");
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]);

  // Statistics
  const stats = useMemo(() => {
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let spoiledCount = 0;
    for (const item of items) {
      if (item.quantity === 0) {
        outOfStockCount++;
      } else {
        if (item.status === "spoiled") {
          spoiledCount++;
        }
        if (item.quantity <= item.minimumThreshold) {
          lowStockCount++;
        }
      }
    }
    return {
      total: items.length,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      spoiled: spoiledCount,
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, activeCategory, searchQuery]);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim()) return;

    try {
      await apiJson("/api/staff/inventory/items", {
        method: "POST",
        json: {
          name: name.trim(),
          category,
          unit,
          quantity,
          minimumThreshold: minThreshold,
          status,
        },
      });
      setName("");
      setQuantity(10);
      setMinThreshold(5);
      setStatus("healthy");
      setShowAddForm(false);
      setSuccess("Inventory item added successfully!");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add item");
    }
  }

  async function handleQuickStockChange(item: InventoryItem, delta: number) {
    setError(null);
    setSuccess(null);
    const newQty = Math.max(0, item.quantity + delta);
    
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i)),
    );

    try {
      await apiJson(`/api/staff/inventory/items/${item.id}`, {
        method: "PATCH",
        json: { quantity: newQty },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update stock");
      // Revert if failed
      await load();
    }
  }

  async function handleStartEdit(item: InventoryItem) {
    setEditingId(item.id);
    setEditQuantity(item.quantity);
    setEditMinThreshold(item.minimumThreshold);
    setEditStatus(item.status || "healthy");
  }

  async function handleSaveEdit(id: string) {
    setError(null);
    setSuccess(null);
    try {
      await apiJson(`/api/staff/inventory/items/${id}`, {
        method: "PATCH",
        json: {
          quantity: editQuantity,
          minimumThreshold: editMinThreshold,
          status: editStatus,
        },
      });
      setEditingId(null);
      setSuccess("Item updated successfully");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save edit");
    }
  }

  async function handleDeleteItem(item: InventoryItem) {
    if (!window.confirm(`Delete "${item.name}" from inventory? This cannot be undone.`)) {
      return;
    }
    setError(null);
    setSuccess(null);
    
    // Optimistic UI update
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    try {
      await apiJson(`/api/staff/inventory/items/${item.id}`, {
        method: "DELETE",
      });
      setSuccess(`Deleted "${item.name}"`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete item");
      await load();
    }
  }

  if (!token) return <Navigate to="/staff/login" replace />;

  return (
    <div className="fade-in animate-in">
      <Link to="/staff" className="back-link">
        ← Back to Dashboard
      </Link>

      <div
        className="section-heading"
        style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            className="section-heading-icon"
            style={{
              background: "linear-gradient(135deg, var(--green), #06b6d4)",
              boxShadow: "0 0 16px var(--green-dim)",
            }}
          >
            🥬
          </div>
          <h2 style={{ fontSize: "1.4rem" }}>Inventory Management</h2>
        </div>
        <button
          className="primary"
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ padding: "8px 16px", borderRadius: "8px" }}
        >
          {showAddForm ? "✕ Close Form" : "➕ Add Ingredient"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Add New Item Form Card */}
      {showAddForm && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <div className="card-title">Add New Ingredient</div>
          <form onSubmit={handleAddItem}>
            <div className="form-row">
              <div className="form-group" style={{ flex: "2", minWidth: "200px" }}>
                <label>Ingredient Name</label>
                <input
                  type="text"
                  placeholder="e.g. Milk, Chocolate Syrup"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ minWidth: "150px" }}>
                <label>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.slice(1).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: "100px" }}>
                <label>Unit</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="Kg">Kg</option>
                  <option value="Liters">Liters</option>
                  <option value="Packets">Packets</option>
                  <option value="Bottles">Bottles</option>
                  <option value="Dozens">Dozens</option>
                  <option value="Cans">Cans</option>
                  <option value="Units">Units</option>
                  <option value="Jars">Jars</option>
                  <option value="Bags">Bags</option>
                </select>
              </div>
              <div className="form-group" style={{ minWidth: "100px" }}>
                <label>Initial Qty</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
              </div>
              <div className="form-group" style={{ minWidth: "100px" }}>
                <label>Min Alert Qty</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(Number(e.target.value))}
                  required
                />
              </div>
              <div className="form-group" style={{ minWidth: "120px" }}>
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as "healthy" | "spoiled")}>
                  <option value="healthy">🥦 Healthy</option>
                  <option value="spoiled">⚠️ Spoiled</option>
                </select>
              </div>
              <div className="form-group" style={{ minWidth: "120px" }}>
                <button type="submit" className="primary" style={{ width: "100%", height: "42px" }}>
                  Save Item
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Stats Summary Tiles */}
      <div className="stat-grid" style={{ marginBottom: "28px" }}>
        <div className="stat-tile">
          <div className="stat-tile-value" style={{ color: "var(--blue)" }}>
            {stats.total}
          </div>
          <div className="stat-tile-label">Total Ingredients</div>
        </div>
        <div className="stat-tile" style={{ borderColor: stats.outOfStock > 0 ? "rgba(239, 68, 68, 0.4)" : undefined }}>
          <div
            className="stat-tile-value"
            style={{ color: stats.outOfStock > 0 ? "var(--red)" : "var(--text-3)" }}
          >
            {stats.outOfStock}
          </div>
          <div className="stat-tile-label">Out of Stock</div>
        </div>
        <div className="stat-tile" style={{ borderColor: stats.lowStock > 0 ? "rgba(245, 158, 11, 0.4)" : undefined }}>
          <div
            className="stat-tile-value"
            style={{ color: stats.lowStock > 0 ? "var(--amber)" : "var(--text-3)" }}
          >
            {stats.lowStock}
          </div>
          <div className="stat-tile-label">Low Stock Alerts</div>
        </div>
        <div className="stat-tile" style={{ borderColor: stats.spoiled > 0 ? "rgba(239, 68, 68, 0.4)" : undefined }}>
          <div
            className="stat-tile-value"
            style={{ color: stats.spoiled > 0 ? "var(--red)" : "var(--green)" }}
          >
            {stats.spoiled}
          </div>
          <div className="stat-tile-label">Spoiled Items</div>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {/* Search bar */}
          <div style={{ flex: "1", minWidth: "280px", position: "relative" }}>
            <input
              type="text"
              placeholder="🔍 Search ingredients by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: "36px",
                borderRadius: "10px",
                background: "var(--surface-3)",
              }}
            />
          </div>

          {/* Categories Pill Nav */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`sm ${activeCategory === cat ? "primary" : ""}`}
                style={{
                  borderRadius: "20px",
                  padding: "6px 14px",
                  background: activeCategory === cat ? undefined : "var(--surface-2)",
                  border: activeCategory === cat ? undefined : "1px solid var(--border)",
                  color: activeCategory === cat ? "#fff" : "var(--text-2)",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Alerts Banner (if any) */}
      {items.some((i) => i.quantity <= i.minimumThreshold) && (
        <div className="alert alert-amber animate-in" style={{ display: "block", marginBottom: "24px", background: "var(--amber-dim)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "#fcd34d", marginBottom: "8px" }}>
            <span>⚠️</span> Low Stock Warnings!
          </div>
          <div style={{ fontSize: "0.85rem", opacity: "0.9" }}>
            The following items need refilling soon:{" "}
            {items
              .filter((i) => i.quantity <= i.minimumThreshold)
              .map((i) => `${i.name} (${i.quantity} ${i.unit})`)
              .join(", ")}
          </div>
        </div>
      )}

      {/* Main Inventory Card */}
      <div className="card" style={{ padding: "0" }}>
        {loading ? (
          <div className="empty">
            <div className="spinner" style={{ margin: "20px auto" }}></div>
            <div className="empty-text">Loading inventory items...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🥬</div>
            <div className="empty-text">
              {searchQuery ? "No matching ingredients found." : "No ingredients in this category yet."}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)", height: "46px" }}>
                  <th style={{ padding: "12px 20px", fontWeight: "600", fontSize: "0.75rem", textTransform: "uppercase" }}>Ingredient</th>
                  <th style={{ padding: "12px 20px", fontWeight: "600", fontSize: "0.75rem", textTransform: "uppercase" }}>Category</th>
                  <th style={{ padding: "12px 20px", fontWeight: "600", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>Stock Level</th>
                  <th style={{ padding: "12px 20px", fontWeight: "600", fontSize: "0.75rem", textTransform: "uppercase" }}>Unit</th>
                  <th style={{ padding: "12px 20px", fontWeight: "600", fontSize: "0.75rem", textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "12px 20px", fontWeight: "600", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isEditing = editingId === item.id;
                  const isOutOfStock = isEditing ? editQuantity === 0 : item.quantity === 0;
                  const isLowStock = !isOutOfStock && (isEditing ? editQuantity <= editMinThreshold : item.quantity <= item.minimumThreshold);

                  // CSS classes for color coding
                  const statusClass = isOutOfStock
                    ? "badge occupied" // red/amber
                    : isLowStock
                    ? "badge occupied"
                    : "badge vacant"; // green

                  const statusText = isOutOfStock
                    ? "Out of Stock"
                    : isLowStock
                    ? "Low Stock"
                    : "Healthy";

                  // Progress percentage for visualization
                  const maxDisplayQty = Math.max(item.minimumThreshold * 3, 20);
                  const progressPct = Math.min(100, (item.quantity / maxDisplayQty) * 100);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        height: "64px",
                        transition: "var(--transition)",
                        background: isOutOfStock
                          ? "rgba(239, 68, 68, 0.02)"
                          : isLowStock
                          ? "rgba(245, 158, 11, 0.02)"
                          : undefined,
                      }}
                      className="inventory-row"
                    >
                      {/* Name */}
                      <td style={{ padding: "12px 20px", fontWeight: "600" }}>
                        <span style={{ color: "var(--text)" }}>{item.name}</span>
                      </td>

                      {/* Category */}
                      <td style={{ padding: "12px 20px" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            background: "var(--surface-3)",
                            border: "1px solid var(--border)",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            color: "var(--text-2)",
                          }}
                        >
                          {item.category}
                        </span>
                      </td>

                      {/* Quantity Input / Display */}
                      <td style={{ padding: "12px 20px", textAlign: "right" }}>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                            <div style={{ width: "80px" }}>
                              <label style={{ fontSize: "0.6rem", marginBottom: "2px" }}>Stock</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(Number(e.target.value))}
                                style={{ padding: "4px 8px", height: "30px", fontSize: "0.8rem", textAlign: "right" }}
                              />
                            </div>
                            <div style={{ width: "80px" }}>
                              <label style={{ fontSize: "0.6rem", marginBottom: "2px" }}>Min Alert</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={editMinThreshold}
                                onChange={(e) => setEditMinThreshold(Number(e.target.value))}
                                style={{ padding: "4px 8px", height: "30px", fontSize: "0.8rem", textAlign: "right" }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                            <span
                              style={{
                                fontSize: "1.1rem",
                                fontWeight: "700",
                                color: isOutOfStock
                                  ? "var(--red)"
                                  : isLowStock
                                  ? "var(--amber)"
                                  : "var(--text)",
                              }}
                            >
                              {item.quantity}
                            </span>
                            {/* Simple inline progress bar */}
                            <div style={{ width: "60px", height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "2px" }}>
                              <div
                                style={{
                                  width: `${progressPct}%`,
                                  height: "100%",
                                  borderRadius: "inherit",
                                  background: isOutOfStock
                                    ? "var(--red)"
                                    : isLowStock
                                    ? "var(--amber)"
                                    : "var(--green)",
                                }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Unit */}
                      <td style={{ padding: "12px 20px", color: "var(--text-2)" }}>{item.unit}</td>

                      {/* Status */}
                      <td style={{ padding: "12px 20px" }}>
                        {isOutOfStock ? (
                          <span className="muted" style={{ fontSize: "1.1rem", color: "var(--text-3)", display: "inline-block", paddingLeft: "10px" }}>—</span>
                        ) : isEditing ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as "healthy" | "spoiled")}
                            style={{ padding: "4px 8px", height: "30px", fontSize: "0.85rem", width: "120px" }}
                          >
                            <option value="healthy">🥦 Healthy</option>
                            <option value="spoiled">⚠️ Spoiled</option>
                          </select>
                        ) : (
                          <span
                            className={item.status === "spoiled" ? "badge occupied" : "badge vacant"}
                            style={{
                              borderColor: item.status === "spoiled"
                                ? "rgba(239, 68, 68, 0.3)"
                                : "rgba(16, 185, 129, 0.3)",
                              color: item.status === "spoiled" ? "#fca5a5" : "#6ee7b7",
                            }}
                          >
                            <span
                              className="badge-dot"
                              style={{
                                background: item.status === "spoiled"
                                  ? "var(--red)"
                                  : "var(--green)",
                              }}
                            ></span>
                            {item.status === "spoiled" ? "Spoiled" : "Healthy"}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 20px", textAlign: "right" }}>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button
                              className="success sm"
                              onClick={() => handleSaveEdit(item.id)}
                            >
                              💾 Save
                            </button>
                            <button
                              className="sm"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                            <button
                              className="sm"
                              onClick={() => handleQuickStockChange(item, -1)}
                              disabled={item.quantity === 0}
                              title="Decrease by 1"
                              style={{ width: "28px", height: "28px", padding: 0 }}
                            >
                              ➖
                            </button>
                            <button
                              className="sm"
                              onClick={() => handleQuickStockChange(item, 1)}
                              title="Increase by 1"
                              style={{ width: "28px", height: "28px", padding: 0 }}
                            >
                              ➕
                            </button>
                            <button
                              className="sm"
                              onClick={() => handleStartEdit(item)}
                              title="Edit item settings"
                              style={{ marginLeft: "8px" }}
                            >
                              ✏️
                            </button>
                            <button
                              className="danger sm"
                              onClick={() => handleDeleteItem(item)}
                              title="Delete from inventory"
                              style={{ width: "28px", height: "28px", padding: 0 }}
                            >
                              🗑️
                            </button>
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
  );
}
