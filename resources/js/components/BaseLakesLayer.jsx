import React from 'react';
import { GeoJSON } from 'react-leaflet';

// Base layer GeoJSON for public lakes.
export default function BaseLakesLayer({ data, hidePredicate, onFeatureClick }) {
  if (!data) return null;
  return (
    <GeoJSON
      data={data}
      filter={(feat) => !hidePredicate?.(feat)}
      style={{ color: '#3388ff', weight: 2, fillOpacity: 0.12 }}
      onEachFeature={(feat, layer) => {
        layer.on('click', () => onFeatureClick && onFeatureClick(feat, layer));
        layer.on('mouseover', () => layer.setStyle({ weight: 3 }));
        layer.on('mouseout', () => layer.setStyle({ weight: 2 }));
      }}
    />
  );
}
