import React from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Small helper to create an SVG pin icon as a data URI for a given color
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

const INFLOW_ICON = createPinIcon('#14b8a6');
const OUTFLOW_ICON = createPinIcon('#7c3aed');

export default function FlowsLayer({ show = false, flows, flowsRef }) {
  if (!show || !Array.isArray(flows)) return null;

  return (
    <>
      {flows.map((f) => {
        const lat = Number(f.latitude);
        const lon = Number(f.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const isInflow = f.flow_type === 'inflow';
        const icon = isInflow ? INFLOW_ICON : OUTFLOW_ICON;
        return (
          <Marker
            key={`flow-${f.id}`}
            position={[lat, lon]}
            icon={icon}
            ref={(el) => {
              try {
                if (!flowsRef || !flowsRef.current) return;
                if (el) flowsRef.current[String(f.id)] = el;
                else delete flowsRef.current[String(f.id)];
              } catch {}
            }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                {(() => { const t = f.flow_type === 'inflow' ? 'Inlet' : (f.flow_type === 'outflow' ? 'Outlet' : String(f.flow_type || '')); return (<strong>{t}</strong>); })()}<br />
                {f.name || 'Flow Point'} {f.is_primary ? <em style={{ color: '#fbbf24' }}>★</em> : null}<br />
                                {f.alt_name && <><em>{f.alt_name}</em><br /></>}

                {f.source && <>Source: {f.source}<br /></>}
                <small>Lat: {lat} Lon: {lon}</small>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
