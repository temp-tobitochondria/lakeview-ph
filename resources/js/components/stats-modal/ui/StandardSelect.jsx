import React from 'react';

export default function StandardSelect({ standards = [], value = '', onChange = () => {}, placeholder = 'Select Applied Standard', style = {}, required = false, disabled = false, title }) {
  return (
    <select
      required={required}
      disabled={disabled}
      aria-disabled={disabled}
      title={title}
      className="pill-btn"
      value={value}
      onChange={onChange}
      style={{ width:'100%', minWidth:0, boxSizing:'border-box', padding:'10px 12px', height:40, lineHeight:'20px', opacity: disabled ? 0.6 : 1, ...style }}
    >
      <option value="">{placeholder}</option>
      {Array.isArray(standards) ? standards.map(s => (
        <option key={s.id} value={s.id}>{s.code || s.name || s.id}</option>
      )) : null}
    </select>
  );
}
