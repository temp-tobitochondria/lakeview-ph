import React, { useEffect, useState, useRef } from "react";
import { Marker, Tooltip } from "react-leaflet";
import { FaRuler, FaDrawPolygon, FaMapMarkerAlt, FaCopy } from "react-icons/fa";
import L from "leaflet";
import ReactDOMServer from "react-dom/server";

// Blue pin icon
const bluePinIcon = new L.DivIcon({
  className: "custom-pin-icon",
  html: ReactDOMServer.renderToString(
    <FaMapMarkerAlt size={28} color="#1e88e5" />
  ),
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -25],
});

const ContextMenu = ({ map, onMeasureDistance, onMeasureArea }) => {
  const [position, setPosition] = useState(null);
  const [latlng, setLatlng] = useState(null);
  const [pins, setPins] = useState([]);
  const menuRef = useRef();

  useEffect(() => {
    if (!map) return;

    const handleContextMenu = (e) => {
      e.originalEvent.preventDefault();
      setPosition({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
      setLatlng(e.latlng);
    };

    const handleClose = () => setPosition(null);

    map.on("contextmenu", handleContextMenu);
    map.on("dragstart", handleClose);

    return () => {
      map.off("contextmenu", handleContextMenu);
      map.off("dragstart", handleClose);
    };
  }, [map]);

  const handleCopyCoords = () => {
    if (latlng) {
      const coords = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
      navigator.clipboard
        .writeText(coords)
        .then(() => {
          M.toast({ html: `Copied: ${coords}`, classes: "green darken-1" });
          setPosition(null);
        })
        .catch(() => {
          M.toast({ html: "Clipboard copy failed.", classes: "red darken-2" });
        });
    }
  };

  const handlePlacePin = () => {
    if (latlng) {
      setPins((prev) => [...prev, latlng]);
      setPosition(null);
    }
  };

  // Remove pin by index
  const handleRemovePin = (idx) => {
    setPins((prev) => prev.filter((_, i) => i !== idx));
    M.toast({ html: "Pin removed", classes: "red darken-2" });
  };

  return (
    <>
      {/* Context Menu */}
      {position && (
        <ul
          className="context-menu glass-panel"
          style={{ top: position.y, left: position.x, position: "absolute" }}
          ref={menuRef}
        >
          <li
            className="context-item"
            onClick={() => {
              onMeasureDistance();
              setPosition(null);
            }}
          >
            <FaRuler className="context-icon" /> Measure Distance
          </li>
          <li
            className="context-item"
            onClick={() => {
              onMeasureArea();
              setPosition(null);
            }}
          >
            <FaDrawPolygon className="context-icon" /> Measure Area
          </li>
          <li className="context-item" onClick={handlePlacePin}>
            <FaMapMarkerAlt className="context-icon" /> Place pin here
          </li>
          <li className="context-item" onClick={handleCopyCoords}>
            <FaCopy className="context-icon" /> Copy Coordinate
          </li>
        </ul>
      )}

      {/* Pins with liquid-glass tooltip */}
      {pins.map((pin, idx) => (
        <Marker
          key={idx}
          position={pin}
          icon={bluePinIcon}
          eventHandlers={{
            contextmenu: () => handleRemovePin(idx), // ✅ Right click to remove
          }}
        >
          <Tooltip
            className="glass-panel"
            direction="top"
            offset={[0, -30]}
            permanent
          >
            <FaMapMarkerAlt style={{ marginRight: 4, color: "#90caf9" }} />
            {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
};

export default ContextMenu;