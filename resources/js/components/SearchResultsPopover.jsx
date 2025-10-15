import React from 'react';
import { FiSearch } from 'react-icons/fi';

export default function SearchResultsPopover({ open, results, loading, error, onClose, onSelect }) {
  if (!open) return null;
  // Try to align with the search bar by reading its DOM rect
  let left = 56, top = 56, width = 420;
  try {
    const bar = document.querySelector('.search-bar');
    if (bar) {
      const r = bar.getBoundingClientRect();
      left = Math.round(r.left);
      top = Math.round(r.bottom) + 8;
      const vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1024;
      width = Math.max(240, Math.min(Math.round(r.width), vw - left - 12));
    }
  } catch {}
  const availableH = (typeof window !== 'undefined') ? Math.max(160, window.innerHeight - top - 24) : 420;
  return (
    <div className="modern-scrollbar" style={{ position: 'fixed', top, left, zIndex: 1300, background: '#fff', color: '#111827', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', width, maxHeight: Math.min(420, availableH), overflowY: 'auto' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
        <FiSearch size={14} style={{ color: '#374151' }} />
        <strong style={{ fontSize: 12, letterSpacing: 0.3, color: '#374151' }}>Search results</strong>
        {/* Removed close button; use SearchBar clear (×) instead */}
      </div>
      {loading && <div style={{ padding: 12, fontSize: 13, color: '#374151' }}>Searching…</div>}
      {error && !loading && <div style={{ padding: 12, fontSize: 13, color: '#b91c1c' }}>{String(error)}</div>}
      {!loading && !error && Array.isArray(results) && results.length === 0 && (
        <div style={{ padding: 12, fontSize: 13 }}>No results.</div>
      )}
      <div>
        {(results || []).map((r, idx) => {
          const attrs = r.attributes || r; // support both unified and flat
          const name = r.name || attrs.name || attrs.lake_name || `Result ${idx+1}`;
          const entity = (r.table || r.entity || '').toString();

          const asText = (v) => Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
          const region = asText(attrs.region) ? String(asText(attrs.region)) : '';
          const province = asText(attrs.province) ? String(asText(attrs.province)) : '';
          // Build location: province, region (omit missing)
          const locParts = [];
          if (province) locParts.push(province);
          if (region) locParts.push(region);
          const loc = locParts.join(', ');

          // Numeric helpers
          const num = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          };
          const classCode = attrs.class_code || attrs.water_class || null;
          const depth = num(attrs.max_depth ?? attrs.depth);
          const elev = num(attrs.elevation ?? attrs.max_elevation);
          const areaNum = num(attrs.surface_area_km2 ?? attrs.area_km2 ?? attrs.surface_area_ha ?? attrs.area_ha ?? attrs.surface_area ?? attrs.area);
          const areaUnit = (() => {
            if (attrs.surface_area_km2 != null || attrs.area_km2 != null) return 'km²';
            if (attrs.surface_area_ha != null || attrs.area_ha != null) return 'ha';
            return null;
          })();
          const areaTextExplicit = attrs.surface_area_text || attrs.area_text || attrs.surface_area_readable || null;
          const areaText = areaTextExplicit
            ? String(areaTextExplicit)
            : (areaNum != null ? `${areaNum.toLocaleString()}${areaUnit ? ` ${areaUnit}` : ''}` : '');

          const makeLakeSentence = () => {
            // Format: "<name> is in <province, region> with the surface area of <area>"
            const parts = [];
            if (loc) parts.push(`${name} is in ${loc}`);
            else parts.push(`${name} is a lake`);
            if (areaText) parts.push(`with the surface area of ${areaText}`);
            return parts.join(' ') + '.';
          };

          const makeGenericSentence = () => {
            const detailParts = [];
            if (loc) detailParts.push(loc);
            if (attrs.category) detailParts.push(String(attrs.category));
            if (attrs.source) detailParts.push(String(attrs.source));
            const suffix = detailParts.length ? ` — ${detailParts.join(' • ')}` : '';
            return `${name}${suffix}`;
          };

          const sentence = (entity === 'lakes' && (attrs.description || '').trim())
            ? String(attrs.description)
            : (entity === 'lakes' ? makeLakeSentence() : makeGenericSentence());

          return (
            <button key={idx}
              onClick={() => onSelect && onSelect(r)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '12px 14px', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700, color: '#111827' }}>{name}</div>
                {entity && <span style={{ fontSize: 11, opacity: 0.6, textTransform: 'capitalize', color: '#6B7280' }}>{entity}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 2, lineHeight: 1.35 }}>{sentence}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
