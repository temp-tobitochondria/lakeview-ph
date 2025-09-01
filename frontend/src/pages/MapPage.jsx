// src/pages/MapPage.jsx
import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Local Components
import SearchBar from "../components/SearchBar";
import LayerControl from "../components/LayerControl";
import CoordinatesScale from "../components/CoordinatesScale";
import MapControls from "../components/MapControls";
import ScreenshotButton from "../components/ScreenshotButton";
import Sidebar from "../components/Sidebar";
import ContextMenu from "../components/ContextMenu";
import MeasureTool from "../components/MeasureTool";
import LakeInfoPanel from "../components/LakeInfoPanel";
import PopulationHeatmap from "../components/PopulationHeatmap";

function MapWithContextMenu({ children }) {
  const map = useMap();
  return children(map);
}

function MapPage() {
  const [selectedView, setSelectedView] = useState("satellite");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);

  const [selectedLake, setSelectedLake] = useState(null);
  const [lakePanelOpen, setLakePanelOpen] = useState(false);

  // Heatmap state
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [heatmapDistance, setHeatmapDistance] = useState(2);
  const [populationSum, setPopulationSum] = useState(null);

  // 🟢 Load GeoJSON lakes from /public/data
  const [lakes, setLakes] = useState([]);

  useEffect(() => {
    const lakeFiles = [
      "LagunadeBay.geojson",
      "LakeBunot.geojson",
      "LakeCalibato.geojson",
      "LakeMohicap.geojson",
      "LakePalakpakin.geojson",
      "LakePandin.geojson",
      "LakeSampaloc.geojson",
      "LakeYambo.geojson",
    ];

    Promise.all(
      lakeFiles.map((file) =>
        fetch(`/data/${file}`).then((res) => res.json())
      )
    ).then((geojsons) => {
      setLakes(geojsons);
    });
  }, []);

  // Measurement tool
  const [measureActive, setMeasureActive] = useState(false);
  const [measureMode, setMeasureMode] = useState("distance");

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

  function togglePopulationHeatmap(on, distanceKm) {
    setHeatmapVisible(on);
    setHeatmapDistance(distanceKm);
  }

  return (
    <div
      className={themeClass}
      style={{ height: "100vh", width: "100vw", margin: 0, padding: 0 }}
    >
      <MapContainer
        center={[14.3409, 121.23477]}
        zoom={10}
        maxBounds={worldBounds}
        maxBoundsViscosity={1.0}
        maxZoom={18}
        minZoom={3}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        {/* Basemap */}
        <TileLayer
          url={basemaps[selectedView]}
          attribution={attribution}
          noWrap={true}
        />

        {/* Render all GeoJSON lakes */}
        {lakes.map((lake, idx) => (
          <GeoJSON
            key={idx}
            data={lake}
            style={{ color: "blue", weight: 2, fillOpacity: 0.4 }}
            eventHandlers={{
              click: () => {
                setSelectedLake({
                  name: lake.name || lake.features[0]?.properties?.name,
                  description: "Lake loaded from GeoJSON",
                  geometry: lake.features[0]?.geometry,
                });
                setLakePanelOpen(true);
              },
              add: (e) => {
                // Prevent default Leaflet "selection" outline
                e.target.eachLayer((layer) => {
                  layer.options.interactive = true; // still clickable
                  layer.options.fillOpacity = 0.4;
                });
              },
            }}
          />
        ))}
        {/* Map Utilities */}
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

        {/* Measurement Tool */}
        <MeasureTool
          active={measureActive}
          mode={measureMode}
          onFinish={() => setMeasureActive(false)}
        />

        {/* Population Heatmap */}
        <PopulationHeatmap
          csvUrl="/data/worldpop.csv"
          lake={selectedLake}
          distanceKm={heatmapDistance}
          visible={heatmapVisible}
          onPopulationSum={setPopulationSum}
        />
      </MapContainer>

      {/* Lake Info Panel */}
      <LakeInfoPanel
        isOpen={lakePanelOpen}
        onClose={() => setLakePanelOpen(false)}
        lake={selectedLake}
        onToggleHeatmap={togglePopulationHeatmap}
        populationSum={populationSum}
      />

      {/* UI Overlays */}
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
