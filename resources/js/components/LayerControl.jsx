// src/components/LayerControl.jsx
import React, { useState } from "react";
import { FiLayers } from "react-icons/fi";

function LayerControl({ selectedView, setSelectedView, showContours, setShowContours, showContourLabels, setShowContourLabels }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="layer-control">
      {/* Floating Button */}
      <button
        className="btn-floating"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Close layer controls" : "Open layer controls"}
      >
        <FiLayers className="icon-layer" />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="layer-panel">
          <h6 className="layer-title">Basemap style</h6>
          <label>
            <input
              type="radio"
              name="map-view"
              value="satellite"
              checked={selectedView === "satellite"}
              onChange={() => setSelectedView("satellite")}
            />
            <span>Satellite</span>
          </label>
          <label>
            <input
              type="radio"
              name="map-view"
              value="topographic"
              checked={selectedView === "topographic"}
              onChange={() => setSelectedView("topographic")}
            />
            <span>Topographic</span>
          </label>
          <label>
            <input
              type="radio"
              name="map-view"
              value="street"
              checked={selectedView === "street"}
              onChange={() => setSelectedView("street")}
            />
            <span>Streets</span>
          </label>
          <label>
            <input
              type="radio"
              name="map-view"
              value="osm"
              checked={selectedView === "osm"}
              onChange={() => setSelectedView("osm")}
            />
            <span>Streets (OSM)</span>
          </label>
          <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
          <h6 className="layer-title">Overlays</h6>
          <label>
            <input
              type="checkbox"
              checked={!!showContours}
              onChange={(e) => setShowContours && setShowContours(e.target.checked)}
            />
            <span>Elevation Contours</span>
          </label>
        </div>
      )}
    </div>
  );
}

export default LayerControl;