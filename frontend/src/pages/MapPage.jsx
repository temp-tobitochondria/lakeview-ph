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
import MeasureTool from "../components/MeasureTool"; // ✅ unified tool

// Utility wrapper for context menu integration
function MapWithContextMenu({ children }) {
  const map = useMap();
  return children(map);
}

function MapPage() {
  const [selectedView, setSelectedView] = useState("satellite");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);

  // ✅ measuring tool state
  const [measureActive, setMeasureActive] = useState(false);
  const [measureMode, setMeasureMode] = useState("distance"); // "distance" | "area"

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
        {/* Base map */}
        <TileLayer url={basemaps[selectedView]} attribution={attribution} noWrap={true} />

        {/* Map utilities */}
        <CoordinatesScale />
        <MapControls />

        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          pinned={sidebarPinned}
          setPinned={setSidebarPinned}
        />

        {/* Context Menu */}
        <MapWithContextMenu>
          {(map) => {
            map.on("click", () => {
              if (!sidebarPinned) setSidebarOpen(false);
            });
            map.on("dragstart", () => {
              if (!sidebarPinned) setSidebarOpen(false);
            });
            return (
              <ContextMenu
                map={map}
                onMeasureDistance={() => {
                  setMeasureMode("distance");
                  setMeasureActive(true);
                }}
                onMeasureArea={() => {
                  setMeasureMode("area");
                  setMeasureActive(true);
                }}
              />
            );
          }}
        </MapWithContextMenu>

        {/* ✅ Mount unified measuring tool */}
        <MeasureTool
          active={measureActive}
          mode={measureMode}
          onFinish={() => setMeasureActive(false)}
        />
      </MapContainer>

      {/* Top-left search */}
      <SearchBar onMenuClick={() => setSidebarOpen(true)} />

      {/* Basemap switcher */}
      <LayerControl selectedView={selectedView} setSelectedView={setSelectedView} />

      {/* Screenshot button */}
      <ScreenshotButton />
    </div>
  );
}

export default MapPage;
