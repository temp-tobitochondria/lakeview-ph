import React, { useEffect, useMemo, useRef, useState } from "react";
import { Polyline, Marker, Pane, useMap } from "react-leaflet";
import L from "leaflet";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// A lightweight tool to draw a path and request an elevation profile from the backend
export default function ElevationProfileTool({ active, onClose }) {
  const map = useMap();
  const [points, setPoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerCursor = useRef("");

  // Reset on toggle
  useEffect(() => {
    if (!active) {
      setPoints([]);
      setMousePos(null);
      setProfile(null);
      setError(null);
      setLoading(false);
    }
  }, [active]);

  // Capture clicks and move to draw a line
  useEffect(() => {
    if (!map || !active) return;
    const container = map.getContainer();
    if (!containerCursor.current) containerCursor.current = container.style.cursor || "";
    container.style.cursor = "crosshair";

    const onClick = (e) => {
      setPoints((prev) => [...prev, e.latlng]);
    };
    const onMouseMove = (e) => setMousePos(e.latlng);
    const onKey = (e) => {
      const k = e.key?.toLowerCase?.();
      if (k === "escape") {
        e.preventDefault();
        cleanup();
        onClose?.();
      }
      if (k === "enter") {
        e.preventDefault();
        if (points.length >= 2) requestProfile();
      }
    };

    map.on("click", onClick);
    map.on("mousemove", onMouseMove);
    window.addEventListener("keydown", onKey, true);

    const cleanup = () => {
      try { map.off("click", onClick); } catch {}
      try { map.off("mousemove", onMouseMove); } catch {}
      try { window.removeEventListener("keydown", onKey, true); } catch {}
      try { container.style.cursor = containerCursor.current || ""; } catch {}
    };

    return cleanup;
  }, [map, active, points]);

  const requestProfile = async () => {
    if (!points || points.length < 2) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    try {
      const gj = {
        type: "LineString",
        coordinates: points.map((p) => [p.lng, p.lat]),
      };
      const res = await fetch("/api/elevation/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: gj, sampleDistance: 40, maxSamples: 1800 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const js = await res.json();
      setProfile(js);
    } catch (e) {
      setError(e?.message || "Failed to get profile");
    } finally {
      setLoading(false);
    }
  };

  const line = useMemo(() => {
    if (!points.length) return null;
    const arr = [...points];
    if (mousePos) arr.push(mousePos);
    return arr;
  }, [points, mousePos]);

  const chartData = useMemo(() => {
    if (!profile || !Array.isArray(profile.points)) return null;
    const labels = profile.points.map((p) => (p.distance_m / 1000).toFixed(2));
    const data = profile.points.map((p) => (p.elevation_m == null ? null : Number(p.elevation_m)));
    return {
      labels,
      datasets: [
        {
          label: "Elevation (m)",
          data,
          borderColor: "#1976d2",
          backgroundColor: "rgba(25,118,210,0.2)",
          spanGaps: false,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [profile]);

  const chartOptions = useMemo(() => ({
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: "Distance (km)" }, ticks: { maxTicksLimit: 8 } },
      y: { title: { display: true, text: "Elevation (m)" }, beginAtZero: false },
    },
    plugins: { legend: { display: false }, tooltip: { intersect: false, mode: "index" } },
  }), []);

  const glass = {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    height: 180,
    zIndex: 1200,
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(6px)",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
    padding: 10,
  };

  return active ? (
    <>
      {line && line.length > 1 && (
        <Polyline positions={line} pathOptions={{ color: "#1976d2", weight: 3 }} />
      )}
      {points.map((p, i) => (
        <Marker
          key={i}
          position={p}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng();
              setPoints((prev) => prev.map((pp, idx) => (idx === i ? ll : pp)));
            },
          }}
          icon={new L.DivIcon({ className: "", html: '<div style="width:10px;height:10px;background:#1976d2;border:2px solid #fff;border-radius:50%"></div>', iconSize: [12, 12], iconAnchor: [6, 6] })}
        />
      ))}
      {/* Bottom glass panel with actions and chart */}
      <div style={glass} className="glass-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <strong style={{ flex: 1 }}>Elevation Profile</strong>
          <button onClick={() => setPoints([])} className="btn btn-xs">Clear</button>
          <button onClick={() => requestProfile()} className="btn btn-xs" disabled={points.length < 2 || loading}>
            {loading ? "Sampling…" : "Compute"}
          </button>
          <button onClick={() => { setPoints([]); setProfile(null); onClose?.(); }} className="btn btn-xs">
            Close
          </button>
        </div>
        {error && <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 6 }}>{error}</div>}
        {profile && (
          <div style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 6 }}>
            <div>Len: {(profile.summary.length_m/1000).toFixed(2)} km</div>
            <div>Min: {profile.summary.min_elev_m?.toFixed?.(1)} m</div>
            <div>Max: {profile.summary.max_elev_m?.toFixed?.(1)} m</div>
            <div>Asc: {profile.summary.total_ascent_m?.toFixed?.(0)} m</div>
            <div>Des: {profile.summary.total_descent_m?.toFixed?.(0)} m</div>
          </div>
        )}
        <div style={{ position: "relative", width: "100%", height: 120 }}>
          {chartData ? <Line data={chartData} options={chartOptions} /> : (
            <div style={{ fontSize: 12, color: "#334155", opacity: 0.8, display: "grid", placeItems: "center", height: "100%" }}>
              {points.length < 2 ? "Click to add points on the map, then press Compute or Enter." : (loading ? "Computing…" : "Press Compute to get profile.")}
            </div>
          )}
        </div>
      </div>
    </>
  ) : null;
}
