// resources/js/pages/AdminInterface/AdminWaterCat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiEye,
  FiEdit2,
  FiMapPin,
  FiExternalLink,
  FiTrash2,
  FiMap,
  FiLayers,
} from "react-icons/fi";

import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import TableLayout from "../../layouts/TableLayout";

// --- Leaflet marker asset fix ---
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function AdminWaterCat() {
  /* ----------------------------- UI State ----------------------------- */
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  /* ----------------------------- Data ----------------------------- */
  const [lakes, setLakes] = useState([]);
  const [selectedLake, setSelectedLake] = useState(null);

  /* ----------------------------- Map ----------------------------- */
  const mapRef = useRef(null);
  const [showLakePoly, setShowLakePoly] = useState(false);
  const [showWatershed, setShowWatershed] = useState(false);
  const [showInflow, setShowInflow] = useState(false);
  const [showOutflow, setShowOutflow] = useState(false);

  const defaultCenter = useMemo(() => [12.8797, 121.7740], []); // Philippines
  const defaultZoom = 6;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLake) return;
    if (selectedLake.bounds && Array.isArray(selectedLake.bounds)) {
      const b = L.latLngBounds(selectedLake.bounds);
      map.fitBounds(b, { padding: [24, 24] });
    } else if (selectedLake.center && Array.isArray(selectedLake.center)) {
      map.flyTo(selectedLake.center, 11, { duration: 0.6 });
    }
  }, [selectedLake]);

  /* ----------------------------- Columns ----------------------------- */
  const columns = useMemo(
    () => [
      { header: "", width: 32, className: "col-xs-hide",
        render: (row) => <input type="checkbox" aria-label={`Select ${row?.name ?? "lake"}`} /> },
      { header: <span className="th-with-icon"><FiMap /> Name</span>, accessor: "name" },
      { header: "Location", accessor: "location" },
      { header: "Surface Area (km²)", accessor: "surface_area", width: 160, className: "col-sm-hide" },
      { header: "Average Depth (m)", accessor: "avg_depth", width: 160, className: "col-md-hide" },
      { header: "Last Updated", accessor: "last_updated", width: 180, className: "col-md-hide" },
    ],
    []
  );

  const actions = useMemo(
    () => [
      { label: "View", type: "default", icon: <FiEye />, onClick: (row) => {} },
      { label: "Edit", type: "edit", icon: <FiEdit2 />, onClick: (row) => {} },
      { label: "Stations", type: "default", icon: <FiMapPin />, onClick: (row) => {} },
      { label: "Public", type: "default", icon: <FiExternalLink />, onClick: (row) => {} },
      { label: "Delete", type: "delete", icon: <FiTrash2 />, onClick: (row) => {} },
    ],
    []
  );

  const fetchLakes = async () => {
    setLoading(true);
    try {
      // TODO: connect API
      setLakes([]);
    } catch {
      setLakes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLakes();
  }, [query, region, status]);

  return (
    <div className="dashboard-card">
      {/* Toolbar */}
      <div className="dashboard-card-header org-toolbar">
        <div className="org-search">
          <FiSearch className="toolbar-icon" />
          <input
            type="text"
            placeholder="Search lakes by name or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="org-filter">
          <FiFilter className="toolbar-icon" />
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">All Regions</option>
          </select>
        </div>

        <div className="org-filter">
          <FiFilter className="toolbar-icon" />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
          </select>
        </div>

        <div className="org-actions-right">
          <button className="pill-btn ghost" onClick={fetchLakes} title="Refresh">
            <FiRefreshCw />
          </button>
          <button className="pill-btn primary" onClick={() => {}} title="Add lake">
            <FiMap />
            <span className="hide-sm">Add Lake</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="dashboard-card-body" style={{ paddingTop: 8 }}>
        {loading && <div className="no-data">Loading…</div>}
        <div className="table-wrapper">
          <TableLayout
            columns={columns}
            data={lakes}
            pageSize={10}
            actions={actions}
          />
        </div>
      </div>

      {/* Map + toggles */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#374151" }}>
            <FiLayers /> Layers
          </span>
          <label className="pill-btn" style={{ gap: 6 }}>
            <input type="checkbox" checked={showLakePoly} onChange={(e) => setShowLakePoly(e.target.checked)} />
            Lake polygon
          </label>
          <label className="pill-btn" style={{ gap: 6 }}>
            <input type="checkbox" checked={showWatershed} onChange={(e) => setShowWatershed(e.target.checked)} />
            Watershed
          </label>
          <label className="pill-btn" style={{ gap: 6 }}>
            <input type="checkbox" checked={showInflow} onChange={(e) => setShowInflow(e.target.checked)} />
            Inflow markers
          </label>
          <label className="pill-btn" style={{ gap: 6 }}>
            <input type="checkbox" checked={showOutflow} onChange={(e) => setShowOutflow(e.target.checked)} />
            Outflow markers
          </label>
        </div>

        <div style={{ height: 500, borderRadius: 12, overflow: "hidden" }}>
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: "100%", width: "100%" }}
            whenCreated={(map) => (mapRef.current = map)}
            scrollWheelZoom
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* TODO: render polygons and markers when backend is ready */}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
