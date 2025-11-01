import React from "react";
import { GeoJSON, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { getToken } from "../lib/api";
import { promptDownloadFormat, alertError } from "../lib/alerts";

// Local helpers for download
function geojsonToKml(geo) {
  try {
    const fc = (geo && geo.type === 'FeatureCollection') ? geo : { type: 'FeatureCollection', features: [geo] };
    const placemarks = [];
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

    const coordsToStr = (coords) => coords.map(c => Array.isArray(c) ? c.join(',') : '').join(' ');
    const ringToKml = (ring) => `<LinearRing><coordinates>${coordsToStr(ring)}</coordinates></LinearRing>`;
    const polyToKml = (poly) => {
      const rings = poly.coordinates || [];
      if (!rings.length) return '';
      const outer = ringToKml(rings[0]);
      const inners = rings.slice(1).map(r => `<innerBoundaryIs>${ringToKml(r)}</innerBoundaryIs>`).join('');
      return `<Polygon><outerBoundaryIs>${outer}</outerBoundaryIs>${inners}</Polygon>`;
    };

    const lineToKml = (line) => `<LineString><coordinates>${coordsToStr(line.coordinates || [])}</coordinates></LineString>`;

    for (const f of (fc.features || [])) {
      const g = f.geometry || {};
      let geomKml = '';
      if (g.type === 'Polygon') geomKml = polyToKml(g);
      else if (g.type === 'MultiPolygon') geomKml = (g.coordinates || []).map(coords => polyToKml({ type:'Polygon', coordinates: coords })).join('');
      else if (g.type === 'LineString') geomKml = lineToKml(g);
      if (!geomKml) continue;
      const name = esc(f.properties?.name || 'Feature');
      placemarks.push(`<Placemark><name>${name}</name>${geomKml}</Placemark>`);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${placemarks.join('')}</Document></kml>`;
  } catch (e) {
    return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>`;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'download.dat';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function createPinIcon(color = '#3388ff') {
  const svg = `<?xml version='1.0' encoding='UTF-8'?>\n<svg xmlns='http://www.w3.org/2000/svg' width='32' height='41' viewBox='0 0 32 41'>\n  <path d='M16 0C9 0 4 5 4 11c0 9.9 12 24 12 24s12-14.1 12-24c0-6-5-11-12-11z' fill='${color}' stroke='#000' stroke-opacity='0.12'/>\n  <circle cx='16' cy='11' r='4' fill='#fff' opacity='0.95'/>\n</svg>`;
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  return L.icon({
    iconUrl: url,
    iconSize: [32, 41],
    iconAnchor: [16, 41],
    popupAnchor: [0, -36],
    className: ''
  });
}

const FLOWPOINT_ICON = createPinIcon('#06b6d4');
const WATERSHEDPOINT_ICON = createPinIcon('#16a34a');

export default function GlobalWatershedsLayer({ watershedFC, riversFC, flowpathFC, flowClickPoint, wsClickPoint }) {
  return (
    <>
      {watershedFC && (
        <GeoJSON
          key={`gw-ws-${JSON.stringify(watershedFC).length}`}
          data={watershedFC}
          style={{ color: 'green', weight: 5, fillColor: 'green', fillOpacity: 0.15 }}
          onEachFeature={(feat, layer) => {
            try { layer.bringToFront(); } catch {}
            try {
              layer.on('click', async () => {
                const token = getToken();
                if (!token) {
                  await alertError('Sign in required', 'You must be a registered user to download watersheds.');
                  return;
                }
                const choice = await promptDownloadFormat({ title: 'Download Watershed', text: 'Choose a format to download this watershed.' });
                if (!choice) return;
                const single = { type: 'FeatureCollection', features: [feat] };
                if (choice === 'geojson') {
                  const blob = new Blob([JSON.stringify(single)], { type: 'application/geo+json' });
                  downloadBlob(blob, 'watershed.geojson');
                } else if (choice === 'kml') {
                  const kml = geojsonToKml(single);
                  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
                  downloadBlob(blob, 'watershed.kml');
                }
              });
            } catch {}
          }}
        />
      )}
      {riversFC && (
        <GeoJSON
          key={`gw-rv-${JSON.stringify(riversFC).length}`}
          data={riversFC}
          style={{ color: '#1976d2', weight: 2.5, opacity: 0.9 }}
          onEachFeature={(feat, layer) => { try { layer.bringToFront(); } catch {} }}
        />
      )}
      {flowpathFC && (
        <GeoJSON
          key={`gw-fp-${JSON.stringify(flowpathFC).length}`}
          data={flowpathFC}
          style={{ color: 'cyan', weight: 5, opacity: 0.95 }}
          onEachFeature={(feat, layer) => { try { layer.bringToFront(); } catch {} }}
        />
      )}

      {flowClickPoint && (
        <Marker
          key={`gw-fp-click-${flowClickPoint.lat.toFixed(6)}-${flowClickPoint.lng.toFixed(6)}`}
          position={[flowClickPoint.lat, flowClickPoint.lng]}
          icon={FLOWPOINT_ICON}
        >
          <Popup>Flow path start</Popup>
        </Marker>
      )}
      {wsClickPoint && (
        <Marker
          key={`gw-ws-click-${wsClickPoint.lat.toFixed(6)}-${wsClickPoint.lng.toFixed(6)}`}
          position={[wsClickPoint.lat, wsClickPoint.lng]}
          icon={WATERSHEDPOINT_ICON}
        >
          <Popup>Watershed seed</Popup>
        </Marker>
      )}
    </>
  );
}
