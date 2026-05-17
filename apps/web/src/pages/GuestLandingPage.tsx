import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from "../logo.png";

export function GuestLandingPage() {
  const navigate = useNavigate();
  const [manualSlug, setManualSlug] = useState("");
  const [selectedSimTable, setSelectedSimTable] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const simulatedTables = Array.from({ length: 10 }, (_, i) => {
    const num = i + 1;
    const slug = `TABLE${String(num).padStart(2, "0")}`;
    return { label: `Table ${num}`, slug };
  });

  function handleStartScan(slug: string) {
    if (!slug) return;
    setIsScanning(true);
    setErrorMessage("");
    setSelectedSimTable(slug);

    // Simulate scanning delay & beep effect
    setTimeout(() => {
      setScanSuccess(true);
      
      // Satisfying success flash & redirect
      setTimeout(() => {
        setIsScanning(false);
        setScanSuccess(false);
        navigate(`/t/${slug}`);
      }, 800);
    }, 1500);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualSlug.trim()) return;
    const sanitized = manualSlug.trim().toUpperCase();
    navigate(`/t/${sanitized}`);
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px 10px" }}>
      {/* Premium Header */}
      <div style={{ textAlign: "center", marginBottom: "30px", marginTop: "10px" }}>
        <img
          src={logo}
          alt="Iris Cafe Logo"
          style={{
            height: "92px",
            objectFit: "contain",
            marginBottom: "12px",
            borderRadius: "14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        />
        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
          Welcome to <span style={{ color: "var(--amber)" }}>Iris Cafe</span>
        </h1>
        <p className="muted" style={{ fontSize: "0.95rem", marginTop: "6px" }}>
          Scan your table QR code to start ordering premium treats instantly.
        </p>
      </div>

      {/* QR Code Scanner Simulator Visual Block */}
      <div className="card" style={{ padding: "0px", overflow: "hidden", border: "1px solid var(--border)" }}>
        {/* Animated Scanner Preview */}
        <div
          style={{
            height: "220px",
            background: "#05070a",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {/* Laser Scanner animation overlay */}
          {isScanning && !scanSuccess && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: "3px",
                background: "linear-gradient(90deg, transparent, var(--green), transparent)",
                boxShadow: "0 0 10px var(--green)",
                animation: "scanline 1.5s infinite ease-in-out",
                zIndex: 2,
              }}
            />
          )}

          {/* Flash animation on scan success */}
          {scanSuccess && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(16, 185, 129, 0.2)",
                animation: "flashGreen 0.6s ease-out",
                zIndex: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "var(--green)",
                  color: "#05070a",
                  padding: "10px 20px",
                  borderRadius: "20px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  boxShadow: "0 0 20px var(--green)",
                }}
              >
                ✓ QR Detected!
              </div>
            </div>
          )}

          {/* Scanner Target Frame */}
          <div
            style={{
              width: "140px",
              height: "140px",
              border: `2px dashed ${isScanning ? "var(--green)" : "var(--border)"}`,
              borderRadius: "16px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.3s ease",
            }}
          >
            {/* Corner Bracket decorations */}
            <div style={{ position: "absolute", top: "-2px", left: "-2px", width: "15px", height: "15px", borderTop: "3px solid var(--amber)", borderLeft: "3px solid var(--amber)", borderRadius: "4px 0 0 0" }} />
            <div style={{ position: "absolute", top: "-2px", right: "-2px", width: "15px", height: "15px", borderTop: "3px solid var(--amber)", borderRight: "3px solid var(--amber)", borderRadius: "0 4px 0 0" }} />
            <div style={{ position: "absolute", bottom: "-2px", left: "-2px", width: "15px", height: "15px", borderBottom: "3px solid var(--amber)", borderLeft: "3px solid var(--amber)", borderRadius: "0 0 0 4px" }} />
            <div style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "15px", height: "15px", borderBottom: "3px solid var(--amber)", borderRight: "3px solid var(--amber)", borderRadius: "0 0 4px 0" }} />

            {!isScanning && (
              <span style={{ fontSize: "2.5rem", opacity: 0.35 }}>📱</span>
            )}
            {isScanning && !scanSuccess && (
              <div style={{ textAlign: "center" }}>
                <span style={{ display: "block", fontSize: "1.5rem", animation: "pulse 1s infinite" }}>🔍</span>
                <span className="text-xs" style={{ color: "var(--green)", fontWeight: 600, display: "block", marginTop: "4px" }}>
                  Analyzing...
                </span>
              </div>
            )}
          </div>

          <div className="text-xs" style={{ color: "var(--text-2)", marginTop: "12px", zIndex: 1 }}>
            {isScanning ? `Scanning QR Code for ${selectedSimTable}...` : "Live Tabletop QR Scanning Simulator"}
          </div>
        </div>

        {/* Content Action Cards */}
        <div style={{ padding: "20px" }}>
          {/* Method 1: Simulated Scan */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-2)" }}>
              Method 1: Click to Simulate Scanning Table QR Code
            </h3>
            <p className="text-xs muted" style={{ marginBottom: "12px" }}>
              Select an active cafe table to simulate scanning its physical QR code with your mobile camera.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "8px",
              }}
            >
              {simulatedTables.map((tab) => (
                <button
                  key={tab.slug}
                  onClick={() => handleStartScan(tab.slug)}
                  disabled={isScanning}
                  className={selectedSimTable === tab.slug && scanSuccess ? "success sm" : "sm"}
                  style={{
                    padding: "8px",
                    fontWeight: 600,
                    borderRadius: "10px",
                    background: selectedSimTable === tab.slug ? "var(--surface-3)" : "rgba(255,255,255,0.02)",
                    borderColor: selectedSimTable === tab.slug ? "var(--amber)" : "var(--border)",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Method 2: Manual code input */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "15px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-2)" }}>
              Method 2: Manual Table Code Entry
            </h3>
            <form onSubmit={handleManualSubmit} className="row" style={{ gap: "8px" }}>
              <input
                value={manualSlug}
                onChange={(e) => setManualSlug(e.target.value)}
                placeholder="Enter Table Slug (e.g., TABLE01)"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontSize: "0.85rem",
                }}
                disabled={isScanning}
                required
              />
              <button
                type="submit"
                className="primary sm"
                disabled={isScanning}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                }}
              >
                Go to Menu
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Quick Info & Help Cards */}
      <div className="card" style={{ border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "6px" }}>
          💡 <span>How it works:</span>
        </div>
        <ol style={{ paddingLeft: "18px", fontSize: "0.82rem", color: "var(--text-2)", display: "flex", flexDirection: "column", gap: "4px" }}>
          <li>Every table in Iris Cafe has a unique QR Code sticker.</li>
          <li>Scanning it opens a direct dining link on the customer's mobile phone.</li>
          <li>Guests select items, customize notes, and click "Send to Kitchen".</li>
          <li>Staff receive the ticket instantly in the kitchen monitor, while inventory is tracked in real-time.</li>
        </ol>
      </div>

      {/* Staff Login Link */}
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <Link to="/staff/login" style={{ fontSize: "0.85rem", color: "var(--text-3)", textDecoration: "underline" }}>
          Are you an employee? Go to Staff Login
        </Link>
      </div>

      {/* Dynamic CSS animations */}
      <style>{`
        @keyframes scanline {
          0% { top: 15%; }
          50% { top: 85%; }
          100% { top: 15%; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.15); opacity: 0.5; }
        }
        @keyframes flashGreen {
          0% { background: rgba(16, 185, 129, 0); }
          50% { background: rgba(16, 185, 129, 0.35); }
          100% { background: rgba(16, 185, 129, 0.2); }
        }
      `}</style>
    </div>
  );
}
