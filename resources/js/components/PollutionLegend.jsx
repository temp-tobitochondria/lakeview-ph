import React from 'react';

export default function PollutionLegend() {
  return (
    <div style={{ position: 'absolute', bottom: 90, left: 12, zIndex: 900, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: 11, maxWidth: 240 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Pollution Severity</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 10, background: 'linear-gradient(90deg, #16a34a, #fbbf24, #ef4444)', borderRadius: 4 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ opacity: 0.85 }}>low</span>
          <span style={{ opacity: 0.85 }}>high</span>
        </div>
      </div>
      <div style={{ marginTop: 6, lineHeight: 1.3, opacity: 0.85 }}>
        Relative severity per station (0–1), normalized using robust caps; redder areas indicate worse measurements.
      </div>
    </div>
  );
}
