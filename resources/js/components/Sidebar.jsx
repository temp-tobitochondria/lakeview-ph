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
  FiMapPin,
} from "react-icons/fi";
import { MapContainer, TileLayer, Rectangle, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";

// MiniMap that stays centered and updates live
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
      style={{ height: "250px", width: "100%" }}
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

function Sidebar({ isOpen, onClose, pinned, setPinned }) {
  return (
    <div className={`sidebar ${isOpen ? "open" : ""} ${pinned ? "pinned" : ""}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/lakeview-logo-alt.png" alt="LakeView PH Logo" />
          <h2 className="sidebar-title">LakeView PH</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Pin button */}
          <button
            className={`sidebar-icon-btn ${pinned ? "active" : ""}`}
            onClick={() => setPinned(!pinned)}
            title={pinned ? "Unpin Sidebar" : "Pin Sidebar"}
          >
            <FiMapPin size={18} />
          </button>

          {/* Close button (hidden if pinned) */}
          {!pinned && (
            <button
              className="sidebar-icon-btn"
              onClick={onClose}
              title="Close Sidebar"
            >
              <FiX size={20} />
            </button>
          )}
        </div>
      </div>

      {/* MiniMap */}
      <div className="sidebar-minimap">
        <MiniMapWrapper />
      </div>

      {/* Menu Links */}
      <ul className="sidebar-menu">
        <li>
          <FiInfo className="sidebar-icon" />{" "}
          <Link to="/about" onClick={!pinned ? onClose : undefined}>
            About LakeView PH
          </Link>
        </li>
        <li>
          <FiBookOpen className="sidebar-icon" />{" "}
          <Link to="/manual" onClick={!pinned ? onClose : undefined}>
            How to use LakeView?
          </Link>
        </li>
        <li>
          <FiSend className="sidebar-icon" />{" "}
          <Link to="/feedback" onClick={!pinned ? onClose : undefined}>
            Submit Feedback
          </Link>
        </li>
        <li>
          <FiGithub className="sidebar-icon" />{" "}
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={!pinned ? onClose : undefined}
          >
            GitHub Page
          </a>
        </li>
        <li>
          <FiDatabase className="sidebar-icon" />{" "}
          <Link to="/data" onClick={!pinned ? onClose : undefined}>
            About the Data
          </Link>
        </li>
      </ul>

      {/* Bottom Menu */}
      <ul className="sidebar-bottom">
        <li>
          <FiSettings className="sidebar-icon" />{" "}
          <Link to="/settings" onClick={!pinned ? onClose : undefined}>
            Settings
          </Link>
        </li>
        <li>
          <FiLogIn className="sidebar-icon" />{" "}
          <Link to="/signin" onClick={!pinned ? onClose : undefined}>
            Sign-in
          </Link>
        </li>
      </ul>
    </div>
  );
}

export default Sidebar;
