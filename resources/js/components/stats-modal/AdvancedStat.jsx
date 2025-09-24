import React, { useState, useEffect } from "react";
import { api, apiPublic, buildQuery } from "../../lib/api";
import { fetchParameters, fetchSampleEvents } from "./data/fetchers";
import { alertSuccess, alertError } from '../../utils/alerts';

export default function AdvancedStat({ lakes = [], params = [], paramOptions: parentParamOptions = [], staticThresholds = {} }) {
  // test mode is now inferred from the user's compare selection (class vs lake)
  const [lakeId, setLakeId] = useState(''); // primary lake selection (first dropdown)
  // Comparison target encoded as "class:CODE" or "lake:ID"
  // (we store it in `compareValue` below)

  const [stations, setStations] = useState([]);
  const [selectedStationIds, setSelectedStationIds] = useState([]);
  const [classes, setClasses] = useState([]);
  const [paramOptions, setParamOptions] = useState([]);
  const [paramCode, setParamCode] = useState('');
  const [standards, setStandards] = useState([]);
  const [appliedStandardId, setAppliedStandardId] = useState('');

  // Adopt parent-provided params first (support both `paramOptions` and legacy `params`), otherwise fetch centrally
  useEffect(() => {
    let aborted = false;
    const normalize = (rows) => rows.map(pr => ({
      id: pr.id,
      key: pr.key || pr.id || pr.code || String(pr.id),
      code: pr.code || pr.key || pr.id || String(pr.id),
      label: pr.label || pr.long_name || pr.full_name || pr.display_name || pr.name || pr.code || String(pr.id),
      unit: pr.unit || pr.parameter?.unit || ''
    }));
    const shallowEq = (a,b) => {
      if (a.length !== b.length) return false;
      for (let i=0;i<a.length;i++) {
        if (a[i].key !== b[i].key || a[i].code !== b[i].code || a[i].label !== b[i].label || a[i].unit !== b[i].unit) return false;
      }
      return true;
    };
    const load = async () => {
      const parentRows = Array.isArray(parentParamOptions) && parentParamOptions.length ? parentParamOptions : (Array.isArray(params) && params.length ? params : null);
      if (parentRows) {
        const norm = normalize(parentRows);
        setParamOptions(prev => shallowEq(prev, norm) ? prev : norm);
        return;
      }
      try {
        const list = await fetchParameters();
        if (!aborted) {
          setParamOptions(prev => shallowEq(prev, list) ? prev : list);
        }
      } catch {
        if (!aborted) setParamOptions([]);
      }
    };
    load();
    return () => { aborted = true; };
    // We intentionally stringify only minimal signatures to avoid infinite loops due to new array identities from parent
  }, [
    JSON.stringify((Array.isArray(parentParamOptions)?parentParamOptions:[]).map(r=>r.id||r.key||r.code)),
    JSON.stringify((Array.isArray(params)?params:[]).map(r=>r.id||r.key||r.code))
  ]);

  const [classCode, setClassCode] = useState('');
  const [compareValue, setCompareValue] = useState(''); // format: "class:CODE" or "lake:ID"
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [cl, setCl] = useState('0.95');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [needsManual, setNeedsManual] = useState(false);
  const [samplePreview, setSamplePreview] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const disabled = loading || !paramCode || !lakeId || !compareValue;

  // infer test mode at runtime: two-sample when compareValue is a lake
  const inferredTest = (compareValue && String(compareValue).startsWith('lake:')) ? 'two-sample' : 'one-sample';

  // Fetch water quality classes
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiPublic('/options/water-quality-classes');
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (!mounted) return;
        const list = rows.map(r => ({ code: r.code || r.id || '', name: r.name || r.code || '' })).filter(r=>r.code);
        if (list.length) setClasses(list);
      } catch (e) {
        console.error('Failed to load classes', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch standards for applied dropdown
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiPublic('/options/wq-standards');
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (!mounted) return;
        setStandards(rows || []);
      } catch (e) {
        console.error('Failed to load standards', e);
        if (mounted) setStandards([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch stations for selected primary lake
  useEffect(() => {
    let mounted = true;
    const targetLake = lakeId || '';
    if (!targetLake) { setStations([]); setSelectedStationIds([]); return; }
    (async () => {
      try {
        const res = await api(`/admin/stations?lake_id=${encodeURIComponent(targetLake)}`);
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!mounted) return;
        if (rows.length) {
          const mapped = rows.map(r => ({ id: r.id, name: r.name || `Station ${r.id}` }));
          setStations(mapped);
          setSelectedStationIds(mapped.map(r => r.id));
          return;
        }
      } catch (e) {
        // fallback to public
      }
      try {
        const qs = buildQuery({ lake_id: targetLake, limit: 1000 });
        const res2 = await apiPublic(`/public/sample-events${qs}`);
        const rows2 = Array.isArray(res2) ? res2 : Array.isArray(res2?.data) ? res2.data : [];
        if (!mounted) return;
        const uniq = new Map();
        rows2.forEach(ev => {
          const sid = ev.station_id || ev.station?.id;
          if (!sid) {
            const lat = ev.latitude ?? ev.station?.latitude;
            const lng = ev.longitude ?? ev.station?.longitude;
            if (lat != null && lng != null) {
              const key = `coord:${lat}:${lng}`;
              if (!uniq.has(key)) uniq.set(key, { id: key, name: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`, isCoord: true, lat, lng });
            }
            return;
          }
          const nm = ev.station?.name || ev.station_name || `Station ${sid}`;
          if (!uniq.has(sid)) uniq.set(sid, { id: sid, name: nm });
        });
        const arr = Array.from(uniq.values());
        setStations(arr);
        setSelectedStationIds(arr.filter(r=>!r.isCoord).map(r => r.id));
      } catch (e) {
        if (mounted) { setStations([]); setSelectedStationIds([]); }
      }
    })();
    return () => { mounted = false; };
  }, [lakeId]);

  // Auto-select class + compare target from lake's class. Fires only when lake changes.
  useEffect(() => {
    if (!lakeId) return;
    const lake = lakes.find(l => String(l.id) === String(lakeId));
    if (!lake) return;
    const raw = lake.class_code || (lake.class && (lake.class.code || lake.class)) || lake.class; // support different shapes
    if (!raw) return;
    const code = String(raw);
    setClassCode(prev => prev === code ? prev : code);
    // If user has NOT chosen a different compare target (or existing compare is a class but mismatched), sync it.
    setCompareValue(prev => {
      if (!prev) return `class:${code}`;
      if (prev.startsWith('class:')) {
        const current = prev.split(':')[1];
        if (current !== code) return `class:${code}`;
      }
      return prev;
    });
  }, [lakeId, lakes]);

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const stationsArr = selectedStationIds && selectedStationIds.length ? selectedStationIds.filter(v=>Number.isFinite(v)) : undefined;
      const body = {
        test: inferredTest,
        parameter_code: paramCode,
        confidence_level: Number(cl),
        date_from: yearFrom ? `${yearFrom}-01-01` : undefined,
        date_to: yearTo ? `${yearTo}-12-31` : undefined,
        station_ids: stationsArr,
        applied_standard_id: appliedStandardId || undefined
      };
      if (inferredTest === 'one-sample') {
        body.lake_id = Number(lakeId);
        if (classCode) body.class_code = String(classCode);
        else if (compareValue && String(compareValue).startsWith('class:')) body.class_code = String(compareValue).split(':')[1];
      } else {
        const other = (compareValue && String(compareValue).startsWith('lake:')) ? Number(String(compareValue).split(':')[1]) : undefined;
        body.lake_ids = [Number(lakeId), other].filter(Boolean);
      }
      const res = await apiPublic('/stats/adaptive', { method: 'POST', body });
      setResult(res);
      if (res && (res.sample_values || res.samples || res.values || res.sample1_values || res.sample2_values)) {
        const pick = res.sample_values || res.samples || res.values || res.sample1_values || res.sample2_values || [];
        if (Array.isArray(pick)) setSamplePreview(pick.slice(0, 200));
      }
      setNeedsManual(false);
      if (res && (res.n || res.n1 || res.type === 'tost' || res.sample_n || res.sample1_n)) {
        let msg = 'Test completed successfully.';
        if (res.warn_low_n) msg = 'Test completed but sample size is low — interpret with caution.';
        alertSuccess('Test Result', msg);
      } else {
        alertSuccess('Test Result', 'Test completed.');
      }
    } catch (e) {
      const msg = e?.message || 'Failed';
      setError(msg);
      const body = e?.body || null;
      console.error('[Stats] Run error:', e, body || 'no-body');
      if (body && body.error === 'threshold_missing') {
        setNeedsManual(true);
        alertError('Missing Threshold', 'No threshold found for this parameter/class — set thresholds in Admin or provide one via API.');
      } else if (body && body.error === 'insufficient_data') {
        const minReq = body.min_required || 3;
        if (body.n != null) {
          alertError('Not enough data', `Not enough samples to run the test: found ${body.n}, need at least ${minReq}.`);
        } else if (body.n1 != null || body.n2 != null) {
          const n1 = body.n1 ?? 0; const n2 = body.n2 ?? 0; const mr = body.min_required ?? minReq;
          alertError('Not enough data', `Not enough samples: group 1 has ${n1}, group 2 has ${n2}; need at least ${mr} each.`);
        } else {
          alertError('Not enough data', `Insufficient data to run the test (need at least ${minReq} observations).`);
        }
      }
      else {
        alertError('Test Error', msg);
      }
    } finally { setLoading(false); }
  };

  const fetchPreview = async () => {
    setPreviewLoading(true);
    setSamplePreview([]);
    try {
      const fmtPreviewDate = (d) => {
        if (!d) return '';
        try { const dt = new Date(d); if (isNaN(dt)) return String(d); return dt.toLocaleString(); } catch (e) { return String(d); }
      };
      const unit = (paramOptions.find(p => p.code === paramCode) || {}).unit || '';
      const mapped = [];
      const sampled_from = yearFrom ? `${yearFrom}-01-01` : undefined;
      const sampled_to = yearTo ? `${yearTo}-12-31` : undefined;

      if (inferredTest === 'two-sample') {
        const other = (compareValue && String(compareValue).startsWith('lake:')) ? String(compareValue).split(':')[1] : undefined;
        const lakeIds = [lakeId, other].filter(Boolean);
        for (const lid of lakeIds) {
          try {
            const recs = await fetchSampleEvents({ lakeId: lid, from: sampled_from, to: sampled_to, limit: 1000 });
            const lakeName = (lakes.find(l => String(l.id) === String(lid)) || {}).name || `Lake ${lid}`;
            for (const ev of recs) {
              const vObj = ev[paramCode];
              const v = vObj && vObj.value != null ? vObj.value : null;
              const unitLocal = vObj && vObj.unit ? vObj.unit : '';
              if (v == null) continue;
              const rawDate = ev.date || ev.rawDate || '';
              const date = fmtPreviewDate(rawDate);
              const station = ev.area || ev.stationCode || '';
              mapped.push({ date, rawDate, station, lake: lakeName, value: v, unit: unitLocal });
              if (mapped.length >= 200) break;
            }
          } catch (e) {
            console.error('[Stats] Preview fetch error for lake', lid, e);
          }
          if (mapped.length >= 200) break;
        }
      } else {
        try {
          const recs = await fetchSampleEvents({ lakeId: lakeId, from: sampled_from, to: sampled_to, limit: 1000 });
          for (const ev of recs) {
            const vObj = ev[paramCode];
            const v = vObj && vObj.value != null ? vObj.value : null;
            const unitLocal = vObj && vObj.unit ? vObj.unit : '';
            if (v == null) continue;
            const rawDate = ev.date || ev.rawDate || '';
            const date = fmtPreviewDate(rawDate);
            const station = ev.area || ev.stationCode || '';
            mapped.push({ date, rawDate, station, value: v, unit: unitLocal });
            if (mapped.length >= 200) break;
          }
        } catch (e) {
          console.error('[Stats] Preview fetch error', e);
        }
      }
      setSamplePreview(mapped);
    } catch (e) {
      console.error('[Stats] Preview fetch error', e);
      setSamplePreview([]);
    } finally { setPreviewLoading(false); }
  };

  const renderResult = () => {
    if (!result) return null;
    const gridItems = [];
    const push = (k, v) => gridItems.push({ k, v });
    const typeLabelMap = {
      'one-sample':'One-sample t-test',
      'one-sample-nonparam':'Wilcoxon signed-rank',
      'two-sample-welch':'Two-sample Welch t-test',
      'two-sample-nonparam':'Mann-Whitney U test',
      'tost':'Equivalence TOST'
    };
    push('Test Selected', typeLabelMap[result.type] || result.type);
    if (result.normality_test) {
      if (result.normality_test.sample1) {
        push('Normality S1', result.normality_test.sample1.normal ? 'Normal' : 'Non-normal');
        push('Normality S2', result.normality_test.sample2.normal ? 'Normal' : 'Non-normal');
      } else if (result.normality_test.normal !== undefined) {
        push('Normality', result.normality_test.normal ? 'Normal' : 'Non-normal');
      }
    }
    if ('n' in result) push('N', result.n || result.sample_n);
    if ('n1' in result) push('N1', result.n1 || result.sample1_n);
    if ('n2' in result) push('N2', result.n2 || result.sample2_n);
    if ('mean' in result) push('Mean', fmt(result.mean));
    if ('median' in result) push('Median', fmt(result.median));
    if ('mean1' in result) push('Mean (Lake 1)', fmt(result.mean1));
    if ('median1' in result) push('Median (Lake 1)', fmt(result.median1));
    if ('mean2' in result) push('Mean (Lake 2)', fmt(result.mean2));
    if ('median2' in result) push('Median (Lake 2)', fmt(result.median2));
    if ('sd' in result) push('SD', fmt(result.sd));
    if ('sd1' in result) push('SD (Lake 1)', fmt(result.sd1));
    if ('sd2' in result) push('SD (Lake 2)', fmt(result.sd2));
    if ('t' in result) push('t statistic', fmt(result.t));
    if ('U' in result) push('U', fmt(result.U));
    if ('z' in result) push('z', fmt(result.z));
    if ('df' in result) push('Degrees Freedom', fmt(result.df));
    if ('p_value' in result) push('p-value', sci(result.p_value));
    if ('mu0' in result) push('Threshold (μ0)', fmt(result.mu0));
    if (result.threshold_min != null) push('Threshold Min', result.threshold_min);
    if (result.threshold_max != null) push('Threshold Max', result.threshold_max);
    if (result.standard_code) push('Standard', result.standard_code);
    if (result.class_code_used) push('Class Used', result.class_code_used);
    if (result.standard_fallback) push('Std Fallback', 'Yes');
    if (result.class_fallback) push('Class Fallback', 'Yes');

    const interpretation = result.interpretation_detail || result.interpretation || '';

    return (
      <div className="stat-box">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
          {gridItems.map((it, i) => (
            <React.Fragment key={i}>
              <div style={{ fontSize:12, opacity:0.85, padding:6, borderBottom:'1px solid rgba(255,255,255,0.03)' }}>{it.k}</div>
              <div style={{ fontSize:13, padding:6, borderBottom:'1px solid rgba(255,255,255,0.03)' }}>{String(it.v)}</div>
            </React.Fragment>
          ))}
        </div>
        {ciLine(result)}
        <div style={{ marginTop:8, padding:8, background:'rgba(255,255,255,0.02)', borderRadius:6 }}>
          <strong>Interpretation:</strong>
          <div style={{ marginTop:6 }}>{interpretation}</div>
          {result.significant != null && (
            <div style={{ marginTop:6, fontSize:12, opacity:0.8 }}>
              Statistical decision: {result.significant ? 'Reject null hypothesis (difference detected).' : 'Fail to reject null hypothesis.'}
            </div>
          )}
        </div>
      </div>
    );
  };

  const fmt = (v) => (v == null ? '' : Number(v).toFixed(2));
  const sci = (v) => (v == null ? '' : (v < 0.001 ? Number(v).toExponential(2) : v.toFixed(4)));
  const ciLine = (r) => (r.ci_lower != null && r.ci_upper != null ? <div>CI ({Math.round((r.ci_level||0)*100)}%): [{fmt(r.ci_lower)}, {fmt(r.ci_upper)}]</div> : null);

  return (
  <div className="insight-card" style={{ minWidth: 680, maxWidth: '100%', maxHeight: '70vh', overflowY: 'auto', padding: 8 }}>
      <h4 style={{ margin: '2px 0 8px' }}>Advanced Statistics</h4>
  <div style={{ display:'grid', gridTemplateColumns:'3fr 3fr 0.6fr 0.6fr', gap:10, alignItems:'start', fontSize:13 }}>
        {/* Row 1: Applied Standard, Parameter, Confidence Level (compact) */}
        <div style={{ gridColumn: '1 / span 1' }}>
          <select className="pill-btn" value={appliedStandardId} onChange={e=>{setAppliedStandardId(e.target.value); setResult(null);}} style={{ width:'100%', padding:'10px 12px', height:40, lineHeight:'20px' }}>
            <option value="">Applied Standard</option>
            {standards.map(s => <option key={s.id} value={s.id}>{s.code || s.name || s.id}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '2 / span 1' }}>
          <select className="pill-btn" value={paramCode} onChange={e=>{setParamCode(e.target.value); setResult(null);}} style={{ width:'100%', padding:'10px 12px', height:40, lineHeight:'20px' }}>
            <option value="">Select parameter</option>
            {paramOptions.length ? (
              paramOptions.map(p => (
                <option key={p.key || p.id || p.code} value={p.key || p.id || p.code}>
                  {p.label || p.name || p.code}
                </option>
              ))
            ) : null}
          </select>
        </div>
        <div style={{ gridColumn: '3 / span 2', display:'flex', justifyContent:'flex-end' }}>
          <select className="pill-btn" value={cl} onChange={e=>{setCl(e.target.value); setResult(null);}} style={{ width:'100%', padding:'8px 10px', fontSize:12, height:36, lineHeight:'18px' }}>
            <option value="0.9">90% CL</option>
            <option value="0.95">95% CL</option>
            <option value="0.99">99% CL</option>
          </select>
        </div>

        {/* Row 2: Lake | Class (header + selector) | Compare Lake | Years */}
        <div style={{ gridColumn: '1 / span 1' }}>
          <select className="pill-btn" value={lakeId} onChange={e=>{setLakeId(e.target.value); setResult(null);}} style={{ width:'100%', padding:'10px 12px', height:40, lineHeight:'20px' }}>
            <option value="">Primary Lake</option>
            {lakes.map(l => <option key={l.id} value={l.id}>{l.name || `Lake ${l.id}`}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '2 / span 1' }}>
          <select className="pill-btn" value={compareValue} onChange={e=>{
            const v = e.target.value;
            setCompareValue(v);
            setResult(null);
            // if user picked a class, keep classCode in sync
            if (v && String(v).startsWith('class:')) {
              setClassCode(String(v).split(':')[1] || '');
            }
          }} style={{ width:'100%', padding:'10px 12px', height:40, lineHeight:'20px' }}>
            <option value="">Compare (Class or Lake)</option>
            {classes.map(c => <option key={`class-${c.code}`} value={`class:${c.code}`}>{`Class ${c.code}`}</option>)}
            <optgroup label="Lakes">
              {lakes.map(l => <option key={`lake-${l.id}`} value={`lake:${l.id}`}>{l.name || `Lake ${l.id}`}</option>)}
            </optgroup>
          </select>
        </div>
        <div style={{ gridColumn: '3 / span 1' }}>
          <input className="pill-btn" type="number" placeholder="Year from" value={yearFrom} onChange={e=>setYearFrom(e.target.value)} style={{ width: '100%', padding:'8px 10px', height:36, lineHeight:'18px' }} />
        </div>
        <div style={{ gridColumn: '4 / span 1' }}>
          <input className="pill-btn" type="number" placeholder="Year to" value={yearTo} onChange={e=>setYearTo(e.target.value)} style={{ width: '100%', padding:'8px 10px', height:36, lineHeight:'18px' }} />
        </div>

        {/* Row 3: station selection removed — lake-level aggregation will be applied in backend */}

        {/* Row 4: actions and notices */}
        <div style={{ gridColumn: '1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ fontSize:12, opacity:0.8 }}>Lake-to-lake comparisons aggregate station measurements per lake (mean).</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="pill-btn liquid" disabled={disabled} onClick={run} style={{ padding:'6px 10px' }}>{loading ? 'Running...' : 'Run Test'}</button>
            <button className="pill-btn" disabled={!paramCode || !lakeId || !compareValue || previewLoading} onClick={fetchPreview} style={{ padding:'6px 10px' }}>{previewLoading ? 'Loading...' : 'Preview Values'}</button>
          </div>
        </div>

        {/* Notices/errors */}
        <div style={{ gridColumn: '1 / -1' }}>
          {error && <div style={{ color:'#ff8080', fontSize:12 }}>{error}{needsManual && ' — Please supply a Manual Threshold (μ0) then rerun.'}</div>}
          {error && (error.includes('threshold_missing') || error.includes('threshold')) && (
            <div style={{ fontSize:11, marginTop:6, color:'#ffd9d9' }}>
              Server debug: <pre style={{ whiteSpace:'pre-wrap', fontSize:11 }}>{JSON.stringify((error && (typeof error === 'string') ? null : null) || '' )}</pre>
            </div>
          )}
          {needsManual && (
            <div style={{ color:'#fbbf24', fontSize:11 }}>
              Tip: A threshold is required by the server for this parameter/class — set thresholds in the admin panel or provide a manual μ0 via API.
            </div>
          )}
        </div>

        {/* Preview table */}
        <div style={{ gridColumn: '1 / -1' }}>
          {samplePreview && samplePreview.length > 0 && (() => {
            const rows = [...samplePreview].sort((a,b) => {
              const ad = a.rawDate ? new Date(a.rawDate).getTime() : 0;
              const bd = b.rawDate ? new Date(b.rawDate).getTime() : 0;
              return bd - ad;
            });
            return (
              <div style={{ marginTop:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ fontSize:12, opacity:0.85 }}>Preview of values being fetched (showing up to 200 rows)</div>
                  <div style={{ fontSize:12, opacity:0.7 }}>{rows.length} rows • times shown in your local timezone</div>
                </div>
                      <div style={{ maxHeight:320, overflow:'auto', border:'1px solid rgba(255,255,255,0.06)', borderRadius:6 }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                          <thead>
                            <tr style={{ textAlign:'left', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                              <th style={{ padding:6, width:220 }}>Date (local)</th>
                              <th style={{ padding:6 }}>Station / Coordinates</th>
                              { (inferredTest === 'two-sample' || samplePreview.some(r => r.lake)) && <th style={{ padding:6, width:160 }}>Lake</th> }
                              <th style={{ padding:6, width:120 }}>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => (
                              <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding:6, width:220 }}>{r.date}</td>
                                <td style={{ padding:6 }}>{r.station}</td>
                                {(inferredTest === 'two-sample' || samplePreview.some(rr => rr.lake)) && <td style={{ padding:6, width:160 }}>{r.lake || ''}</td>}
                                <td style={{ padding:6, width:120 }}>{r.value}{r.unit ? ` ${r.unit}` : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
              </div>
            );
          })()}
        </div>

        {/* Result */}
        <div style={{ gridColumn: '1 / -1' }}>{renderResult()}</div>
      </div>
    </div>
  );
}

function suggestThreshold(paramCode, classCode, staticThresholds) {
  if (!paramCode || !classCode) return null;
  const entry = staticThresholds[paramCode];
  if (!entry) return null;
  if (entry.type === 'range') return null; // need both bounds; skip auto-fill
  const val = entry[classCode];
  if (val == null) return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

