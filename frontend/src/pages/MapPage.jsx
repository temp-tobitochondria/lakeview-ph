import React, { useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import SearchBar from "../components/SearchBar";
import LayerControl from "../components/LayerControl";
import CoordinatesScale from "../components/CoordinatesScale";
import MapControls from "../components/MapControls";
import ScreenshotButton from "../components/ScreenshotButton";
import Sidebar from "../components/Sidebar";
import ContextMenu from "../components/ContextMenu";


// Helper wrapper to expose Leaflet map instance
function MapWithContextMenu({ children }) {
  const map = useMap();
  return children(map);
}

function MapPage() {
  const [selectedView, setSelectedView] = useState("satellite");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const basemaps = {
    satellite:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    street:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    topographic:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  };

  const attribution =
    '&copy; <a href="https://www.esri.com/">Esri</a>, ' +
    "Earthstar Geographics, GIS User Community, " +
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors';

  const worldBounds = [
    [-85, -180],
    [85, 180],
  ];

  const themeClass = selectedView === "satellite" ? "map-dark" : "map-light";

  return (
    <div
      className={themeClass}
      style={{ height: "100vh", width: "100vw", margin: 0, padding: 0 }}
    >
      <MapContainer
        center={[14.3409, 121.23477]}
        zoom={11}
        maxBounds={worldBounds}
        maxBoundsViscosity={1.0}
        maxZoom={18}
        minZoom={3}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={basemaps[selectedView]}
          attribution={attribution}
          noWrap={true}
        />
        <CoordinatesScale />
        <MapControls />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* ✅ Pass map instance to ContextMenu */}
        <MapWithContextMenu>
          {(map) => <ContextMenu map={map} />}
        </MapWithContextMenu>
      </MapContainer>

      <SearchBar onMenuClick={() => setSidebarOpen(true)} />
      <LayerControl
        selectedView={selectedView}
        setSelectedView={setSelectedView}
      />
      <ScreenshotButton />
    </div>
  );
}

export default MapPage;
