// src/components/Sidebar.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  FiX,
  FiInfo,
  FiBookOpen,
  FiSend,
  FiGithub,
  FiDatabase,
  FiSettings,
  FiLogIn,
} from "react-icons/fi";
import { MapContainer, TileLayer, Rectangle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// MiniMap that stays perfectly centered and updates live
function MiniMap({ parentMap }) {
  const [bounds, setBounds] = useState(parentMap.getBounds());
  const [center, setCenter] = useState(parentMap.getCenter());
  const [zoom, setZoom] = useState(parentMap.getZoom());
  const minimapRef = useRef();

  useEffect(() => {
    function update() {
      setBounds(parentMap.getBounds());
      setCenter(parentMap.getCenter());
      setZoom(parentMap.getZoom());
      // Also update minimap view
      const mini = minimapRef.current;
      if (mini) {
        mini.setView(parentMap.getCenter(), Math.max(parentMap.getZoom() - 3, 1));
      }
    }
    parentMap.on("move", update);
    parentMap.on("zoom", update);

    return () => {
      parentMap.off("move", update);
      parentMap.off("zoom", update);
    };
  }, [parentMap]);

  return (
    <MapContainer
      center={center}
      zoom={Math.max(zoom - 3, 1)}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      attributionControl={false}
      style={{ height: "250px", width: "100%" }}   // ✅ Resized minimap
      ref={minimapRef}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Rectangle bounds={bounds} pathOptions={{ color: "red", weight: 1 }} />
    </MapContainer>
  );
}

function MiniMapWrapper() {
  const map = useMap();
  return <MiniMap parentMap={map} />;
}

function Sidebar({ isOpen, onClose }) {
  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-title">LakeView PH</h2>
        <button className="sidebar-close-btn" onClick={onClose}>
          <FiX size={20} />
        </button>
      </div>

      <div className="sidebar-minimap">
        <MiniMapWrapper />
      </div>

      <ul className="sidebar-menu">
        <li><FiInfo className="sidebar-icon" /> <span>About LakeView PH</span></li>
        <li><FiBookOpen className="sidebar-icon" /> <span>How to use LakeView?</span></li>
        <li><FiSend className="sidebar-icon" /> <span>Submit Feedback</span></li>
        <li><FiGithub className="sidebar-icon" /> <span>GitHub Page</span></li>
        <li><FiDatabase className="sidebar-icon" /> <span>About the Data</span></li>
      </ul>

      <ul className="sidebar-bottom">
        <li><FiSettings className="sidebar-icon" /> <span>Settings</span></li>
        <li><FiLogIn className="sidebar-icon" /> <span>Sign-in</span></li>
      </ul>
    </div>
  );
}

export default Sidebar;
