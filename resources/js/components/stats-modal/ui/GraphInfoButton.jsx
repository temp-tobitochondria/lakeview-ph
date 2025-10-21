import React from 'react';
import { FiInfo } from 'react-icons/fi';

export default function GraphInfoButton({ disabled, titleWhenDisabled='Generate a chart first', onClick }) {
  return (
    <button
      type="button"
      title={disabled ? titleWhenDisabled : 'Explain this graph'}
      disabled={disabled}
      onClick={onClick}
      aria-label={disabled ? titleWhenDisabled : 'Explain this graph'}
      style={{
        width: 34,
        height: 34,
        padding: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.06)',
        background: disabled ? 'rgba(255,255,255,0.03)' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
  <FiInfo size={16} color="#fff" />
    </button>
  );
}
