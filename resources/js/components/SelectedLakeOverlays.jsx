import React from "react";
import { GeoJSON } from "react-leaflet";
import * as turf from '@turf/turf';

export default function SelectedLakeOverlays({ watershedOverlayFeature, lakeOverlayFeature }) {
  return (
    <>
      {watershedOverlayFeature && (
        <GeoJSON
          key={`watershed-${watershedOverlayFeature?.properties?.layer_id || 'x'}-${JSON.stringify(watershedOverlayFeature?.geometry ?? {}).length}`}
          data={watershedOverlayFeature}
          style={{ color: '#16a34a', weight: 2, fillOpacity: 0.15 }}
          onEachFeature={(feat, layer) => {
            const nm = feat?.properties?.name || 'Watershed';
            let tooltip = nm;
            try {
              const area = turf.area(feat); // square meters
              const areaKm2 = (area / 1e6).toFixed(2);
              tooltip = `${nm} (${areaKm2} km²)`;
            } catch {}
            layer.bindTooltip(tooltip, { sticky: true });
          }}
        />
      )}

      {lakeOverlayFeature && (
        <GeoJSON
          key={`lake-overlay-${lakeOverlayFeature?.properties?.layer_id || 'x'}-${JSON.stringify(lakeOverlayFeature?.geometry ?? {}).length}`}
          data={lakeOverlayFeature}
          style={() => ({ color: '#3388ff', weight: 2.5, fillOpacity: 0.20 })}
          onEachFeature={(feat, layer) => {
            const nm = feat?.properties?.name || 'Layer';
            layer.bindTooltip(nm, { sticky: true });
          }}
        />
      )}
    </>
  );
}
