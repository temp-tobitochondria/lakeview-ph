import React, { useEffect, useState } from 'react';
import axios from 'axios';
import LoadingSpinner from '../LoadingSpinner';

// Minimal parameter selector for now: Overall vs specific ID entry (can be replaced with API-driven list)
export default function PollutionTab({
  lake,
  onTogglePollution,
  onClearPollution,
  enabled = false,
  loading = false,
}) {
  const [parameter, setParameter] = useState('overall');
  const [agg, setAgg] = useState('latest');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paramsLoading, setParamsLoading] = useState(false);
  const [paramsError, setParamsError] = useState(null);
  const [options, setOptions] = useState([]); // [{id, code, name, unit, evaluation_type, is_active}]

  // Ensure lake change resets state
  useEffect(() => {
    setParameter('overall'); setAgg('latest'); setFrom(''); setTo('');
  }, [lake?.id]);

  // Fetch parameter options once
  useEffect(() => {
    let active = true;
    const load = async () => {
      setParamsLoading(true); setParamsError(null);
      try {
        const { data } = await axios.get('/api/options/parameters');
        if (!active) return;
        // Prefer active params and those with evaluation_type defined; sort by code then name
        const rows = Array.isArray(data) ? data.slice() : [];
        rows.sort((a,b) => String(a.code || '').localeCompare(String(b.code || '')) || String(a.name || '').localeCompare(String(b.name || '')));
        setOptions(rows);
      } catch (e) {
        if (!active) return;
        setOptions([]);
        setParamsError('Failed to load parameters');
      } finally {
        if (active) setParamsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const canShow = lake?.id != null;

  const handleShow = () => {
    if (!canShow) return;
    onTogglePollution?.(true, {
      parameter: parameter === 'overall' ? 'overall' : Number(parameter),
      agg,
      from: from || null,
      to: to || null,
      loading: true
    });
  };

  const handleRefresh = () => {
    if (!canShow) return;
    onTogglePollution?.(true, {
      parameter: parameter === 'overall' ? 'overall' : Number(parameter),
      agg,
      from: from || null,
      to: to || null,
      loading: true
    });
  };

  const handleClear = () => {
    onClearPollution?.();
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>Pollution Heatmap</h3>
        <div style={{ fontSize: 13, color: '#ddd' }}>Visualize relative pollution severity using sampling data around <strong style={{ color: '#fff' }}>{lake?.name}</strong>.</div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ color: '#fff', fontSize: 13 }}>Parameter</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={parameter} onChange={(e)=>setParameter(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6 }} disabled={paramsLoading}>
            <option value="overall">Overall</option>
            {options.filter(p => p?.is_active !== false).map(p => (
              <option key={p.id} value={p.id}>{p.code ? `${p.code} — ${p.name}` : p.name}{p.unit ? ` (${p.unit})` : ''}</option>
            ))}
          </select>
          {paramsLoading && <span style={{ color: '#bbb', fontSize: 12 }}><LoadingSpinner label="Loading params…" size={14} color="#fff" inline={true} /></span>}
          {paramsError && <span style={{ color: '#fca5a5', fontSize: 12 }}>{paramsError}</span>}
        </div>
        {parameter !== 'overall' && (() => {
          const p = options.find(o => String(o.id) === String(parameter));
          if (!p) return null;
          return (
            <div style={{ color: '#bbb', fontSize: 12 }}>
              Selected: <strong style={{ color: '#fff' }}>{p.code ? `${p.code} — ${p.name}` : p.name}</strong>
              {p.unit ? ` (${p.unit})` : ''} · Eval: {p.evaluation_type || '—'}
            </div>
          );
        })()}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ color: '#fff', fontSize: 13 }}>Aggregation</label>
        <select value={agg} onChange={(e)=>setAgg(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6 }}>
          <option value="latest">Latest per station</option>
          <option value="avg">Average over range</option>
          <option value="max">Maximum over range</option>
        </select>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label style={{ color: '#fff', fontSize: 13 }}>Date Range (optional)</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6 }} />
          <span style={{ color: '#aaa' }}>to</span>
          <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
        <button
          type="button"
          onClick={handleClear}
          disabled={!enabled}
          style={{ padding: '8px 10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', width: 110 }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleShow}
          disabled={!canShow}
          style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', fontWeight: 600, width: 160 }}
        >
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <LoadingSpinner label="Showing…" size={16} color="#fff" inline={true} />
            </span>
          ) : 'Show Heatmap'}
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={!enabled}
          style={{ padding: '8px 10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', width: 110 }}
        >
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <LoadingSpinner label="Refreshing…" size={16} color="#fff" inline={true} />
            </span>
          ) : 'Refresh'}
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.4 }}>
        Intensities show relative severity (0–1) capped by the 95th percentile and compressed to keep the map readable.
      </div>
    </div>
  );
}
