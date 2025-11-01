import React from "react";
import { GeoJSON } from "react-leaflet";

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
            layer.bindTooltip(nm, { sticky: true });
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
