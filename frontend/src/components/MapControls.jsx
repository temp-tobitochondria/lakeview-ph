// src/components/MapControls.jsx
import React, { useState } from "react";
import { useMap, Marker, Popup } from "react-leaflet";
import { FiBarChart2, FiCrosshair, FiPlus, FiMinus } from "react-icons/fi";
import { FaLocationDot } from "react-icons/fa6"; // filled location dot
import L from "leaflet";
import ReactDOMServer from "react-dom/server";

// Filled location icon
const locationIcon = new L.DivIcon({
  className: "custom-location-icon",
  html: ReactDOMServer.renderToString(
    <FaLocationDot size={30} color="#e53935" /> // ✅ Bright red for visibility
  ),
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -28],
});

function MapControls() {
  const map = useMap();
  const [geolocated, setGeolocated] = useState(false);
  const [position, setPosition] = useState(null);

  // ✅ Default view (from your MapContainer)
  const defaultCenter = [14.3409, 121.23477];
  const defaultZoom = 11;

  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();

  const handleGeolocation = () => {
    if (!geolocated) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            const userPos = [latitude, longitude];
            setPosition(userPos);
            map.setView(userPos, 14);
            setGeolocated(true);
          },
          () => alert("Unable to fetch your location.")
        );
      }
    } else {
      // ✅ Reset to default view
      map.setView(defaultCenter, defaultZoom);
      setPosition(null);
      setGeolocated(false);
    }
  };

  return (
    <>
      {/* Floating Controls */}
      <div className="map-controls">
        <button className="btn-floating"><FiBarChart2 className="icon-layer" /></button>
        <button className="btn-floating" onClick={handleGeolocation}><FiCrosshair className="icon-layer" /></button>
        <button className="btn-floating" onClick={handleZoomIn}><FiPlus className="icon-layer" /></button>
        <button className="btn-floating" onClick={handleZoomOut}><FiMinus className="icon-layer" /></button>
      </div>

      {/* Location Marker */}
      {position && (
        <Marker position={position} icon={locationIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}
    </>
  );
}

export default MapControls;