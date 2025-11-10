import React from 'react';
import LoadingSpinner from '../../LoadingSpinner';

// Generic station dropdown with optional "All" entry and customizable allValue/allLabel.
export default function StationSelect({
  options = [],
  value = '',
  onChange = () => {},
  disabled = false,
  includeAllOption = true,
  allValue = 'all',
  allLabel = 'All Stations',
  placeholder = 'Select a station',
  showPlaceholder = true,
  style = {},
  loading = false,
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        className="pill-btn"
        value={value}
        onChange={onChange}
        disabled={disabled || loading}
        style={{ width:'100%', minWidth:0, boxSizing:'border-box', padding:'10px 12px', height:40, lineHeight:'20px', paddingRight: loading ? 44 : 12, ...style }}
      >
        {showPlaceholder && <option value="">{placeholder}</option>}
        {includeAllOption && <option value={allValue}>{allLabel}</option>}
        {options.map(s => (
          <option key={`station-${s.id}`} value={s.id}>{s.name}</option>
        ))}
      </select>
      {loading ? (
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
          <LoadingSpinner inline size={16} label="" />
        </div>
      ) : null}
    </div>
  );
}
