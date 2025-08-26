// src/components/ContextMenu.jsx
import React, { useEffect, useState, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import { FaRuler, FaDrawPolygon, FaMapMarkerAlt, FaCopy } from "react-icons/fa";
import L from "leaflet";
import ReactDOMServer from "react-dom/server";

// ✅ Blue marker icon using React
const bluePinIcon = new L.DivIcon({
  className: "custom-pin-icon",
  html: ReactDOMServer.renderToString(
    <FaMapMarkerAlt size={28} color="#1e88e5" /> // Blue pin
  ),
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -25],
});

const ContextMenu = ({ map, onAction }) => {
  const [position, setPosition] = useState(null);
  const [latlng, setLatlng] = useState(null);
  const [pins, setPins] = useState([]); // ✅ store placed pins
  const menuRef = useRef();

  useEffect(() => {
    if (!map) return;

    const handleContextMenu = (e) => {
      e.originalEvent.preventDefault();
      console.log("Context click:", e.latlng);
      setPosition({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
      });
      setLatlng(e.latlng);
    };

    const handleClose = () => {
      setPosition(null);
    };

    map.on("contextmenu", handleContextMenu);
    map.on("dragstart", handleClose);

    return () => {
      map.off("contextmenu", handleContextMenu);
      map.off("dragstart", handleClose);
    };
  }, [map]);

  if (!position)
    return (
      <>
        {pins.map((pin, idx) => (
          <Marker key={idx} position={pin} icon={bluePinIcon}>
            <Popup>
              📍 Pinned at <br />
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </Popup>
          </Marker>
        ))}
      </>
    );

  const handleCopyCoords = () => {
    if (latlng) {
      const coords = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
      console.log("Trying to copy:", coords);

      navigator.clipboard
        .writeText(coords)
        .then(() => {
          alert(`Copied: ${coords}`);
          setPosition(null); // close menu
        })
        .catch(() => {
          alert("Clipboard copy failed.");
        });
    }
  };

  const handlePlacePin = () => {
    if (latlng) {
      setPins((prev) => [...prev, latlng]); // add pin
      setPosition(null);
    }
  };

  return (
    <>
      {/* Context Menu */}
      <ul
        className="context-menu glass-panel collection z-depth-3"
        style={{
          top: position.y,
          left: position.x,
          position: "absolute",
        }}
        ref={menuRef}
      >
        <li className="collection-item context-item">
          <FaRuler className="context-icon" /> Measure Distance
        </li>
        <li className="collection-item context-item">
          <FaDrawPolygon className="context-icon" /> Measure Area
        </li>
        <li className="collection-item context-item" onClick={handlePlacePin}>
          <FaMapMarkerAlt className="context-icon" /> Place pin here
        </li>
        <li className="collection-item context-item" onClick={handleCopyCoords}>
          <FaCopy className="context-icon" /> Copy Coordinate
        </li>
      </ul>

      {/* ✅ Render pins */}
      {pins.map((pin, idx) => (
        <Marker key={idx} position={pin} icon={bluePinIcon}>
          <Popup>
            📍 Pinned at <br />
            {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export default ContextMenu;
