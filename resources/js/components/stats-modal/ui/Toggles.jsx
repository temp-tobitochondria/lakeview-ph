import React from 'react';

export function SeriesModeToggle({ mode, onChange, disabled = false }) {
  return (
    <label style={{ display: 'block', width: '100%' }}>
      <select
        className="pill-btn"
        aria-label="Series mode"
        value={mode}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
      >
        <option value="avg">Average</option>
        <option value="per-station">Per-station</option>
      </select>
    </label>
  );
}

export function TimeDepthToggle({ viewMode, setViewMode }) {
  return (
    <button
      type="button"
      className="pill-btn"
      onClick={() => setViewMode((m) => (m === 'time' ? 'depth' : 'time'))}
      title={viewMode === 'time' ? 'Show depth profile' : 'Show time series'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      {viewMode === 'time' ? 'Depth profile' : 'Time series'}
    </button>
  );
}

export function SummaryPanel({ title, n, meanLabel='Mean', mean, medianLabel='Median', median }) {
  const fmt = (v) => (Number.isFinite(v) ? Number(v).toFixed(2) : 'N/A');
  return (
    <div style={{ opacity: 0.9 }}>
      {title ? <strong>{title}</strong> : null}
      <div>Samples: {n || 0}</div>
      <div>{meanLabel}: {fmt(mean)}</div>
      <div>{medianLabel}: {fmt(median)}</div>
    </div>
  );
}
