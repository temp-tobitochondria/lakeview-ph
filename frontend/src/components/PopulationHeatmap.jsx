// src/components/PopulationHeatmap.jsx
import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import Papa from "papaparse";
import * as turf from "@turf/turf";
import "leaflet.heat";
import L from "leaflet";

export default function PopulationHeatmap({ csvUrl, lake, distanceKm, visible, onPopulationSum }) {
  const map = useMap();
  const [layer, setLayer] = useState(null);
  const [markersLayer, setMarkersLayer] = useState(null);

  useEffect(() => {
    if (!visible) {
      if (layer) map.removeLayer(layer);
      if (markersLayer) map.removeLayer(markersLayer);
      setLayer(null);
      setMarkersLayer(null);
      onPopulationSum?.(0);
      return;
    }

    Papa.parse(csvUrl, {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (result) => {
        // ✅ Fix: handle lowercase headers
        let rows = result.data.filter(
          (row) => (row.X || row.x) && (row.Y || row.y) && (row.Z || row.z)
        );

        console.log("Parsed rows:", rows.length);
        console.log("Sample row:", rows[0]);

        // --- compute 95th percentile cap for normalization
        const values = rows.map((row) => row.Z || row.z).sort((a, b) => a - b);
        const cap = values[Math.floor(values.length * 0.95)] || 1;

        let heatData = rows.map((row) => {
          const lon = row.X ?? row.x;
          const lat = row.Y ?? row.y;
          const z = row.Z ?? row.z;
          return [lat, lon, Math.min(z, cap) / cap, z];
        });

        console.log("Total before filter:", heatData.length);

        // --- distance filter (buffer around lake polygon)
       if (lake?.geometry) {
  try {
    const lakePolygon = turf.feature(lake.geometry);

    // Buffer around lake
    const buffer = turf.buffer(lakePolygon, distanceKm, {
      units: "kilometers",
          });

          // Try to subtract lake from buffer
          let bufferWithoutLake = null;
          try {
            bufferWithoutLake = turf.difference(buffer, lakePolygon);
          } catch (err) {
            console.warn("⚠️ turf.difference failed, using buffer only:", err);
          }

          // Use whichever geometry is valid
          const filterPolygon = bufferWithoutLake || buffer;

          heatData = heatData.filter(([lat, lon]) =>
            turf.booleanPointInPolygon(
              turf.point([lon, lat]),
              filterPolygon
            )
          );
        } catch (e) {
          console.warn("⚠️ Buffer filtering failed completely:", e);
        }
      }



        console.log("Total after filter:", heatData.length);

        // --- calculate total population sum
        const totalPop = heatData.reduce((sum, d) => sum + (d[3] || 0), 0);
        console.log("Population sum:", totalPop);
        onPopulationSum?.(Math.round(totalPop));

        // --- heatmap rendering
        const heatPoints = heatData.map(([lat, lon, norm]) => [lat, lon, norm]);
        const heat = L.heatLayer(heatPoints, {
          radius: 45,
          blur: 30,
          maxZoom: 15,
          gradient: {
            0.2: "blue",
            0.4: "lime",
            0.6: "yellow",
            0.8: "orange",
            1.0: "red",
          },
        });

        // --- tooltips for values
        const markerGroup = L.layerGroup();
        heatData.forEach(([lat, lon, _, z]) => {
          const marker = L.circleMarker([lat, lon], {
            radius: 5,
            opacity: 0,
            fillOpacity: 0,
          });
          marker.bindTooltip(`Population: ${Math.round(z).toLocaleString()}`);
          markerGroup.addLayer(marker);
        });

        // --- replace old layers
        if (layer) map.removeLayer(layer);
        if (markersLayer) map.removeLayer(markersLayer);

        heat.addTo(map);
        markerGroup.addTo(map);

        setLayer(heat);
        setMarkersLayer(markerGroup);
      },
    });
  }, [map, csvUrl, distanceKm, visible, lake]);

  return null;
}
