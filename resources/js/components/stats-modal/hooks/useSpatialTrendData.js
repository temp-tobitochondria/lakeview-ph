import { useMemo } from 'react';
import { eventStationName, parseIsoDate } from '../utils/dataUtils';

// Build spatial trend datasets across stations for a single lake selection
// Inputs:
// - events: array of sample events (each with sampled_at, results[])
// - selectedStations: string[] of station names (order used for x-axis)
// - selectedParam: parameter id/code to plot
// - snapshot: 'latest' | 'mean' (latest value per station, or mean over filtered range)
// - depthMode: 'surface' | 'avg' (only ~0m values or all depths averaged)
// - paramOptions: optional parameter metadata list
// Output: { labels: string[], datasets: ChartDataset[], unit: string }
export default function useSpatialTrendData({ events, selectedStations = [], selectedParam, snapshot = 'latest', depthMode = 'surface', paramOptions = [] }) {
  return useMemo(() => {
    if (!selectedParam || !Array.isArray(selectedStations) || selectedStations.length === 0) {
      return { labels: [], datasets: [], unit: '' };
    }
    const labels = selectedStations.slice();

    // Per station aggregation
    const byStation = new Map(); // name -> { latestDate, latestVal, sum, cnt, unit }
    const isSurface = (d) => {
      if (d == null) return depthMode !== 'surface';
      const n = Number(d);
      if (!Number.isFinite(n)) return depthMode !== 'surface';
      return depthMode === 'surface' ? Math.abs(n) <= 0.25 : true;
    };
    const parseDate = parseIsoDate;

    for (const ev of Array.isArray(events) ? events : []) {
      const sName = eventStationName(ev) || '';
      if (!labels.includes(sName)) continue;
      const d = parseDate(ev?.sampled_at);
      const results = Array.isArray(ev?.results) ? ev.results : [];
      for (const r of results) {
        const p = r?.parameter; if (!p) continue;
        const match = (String(p.code) === String(selectedParam)) || (String(p.id) === String(selectedParam)) || (String(r.parameter_id) === String(selectedParam));
        if (!match) continue;
        if (!isSurface(r?.depth_m)) continue;
        const v = Number(r?.value);
        if (!Number.isFinite(v)) continue;
        const rec = byStation.get(sName) || { latestDate: null, latestVal: null, sum: 0, cnt: 0, unit: p?.unit || '' };
        if (snapshot === 'latest') {
          if (!rec.latestDate || (d && rec.latestDate && d > rec.latestDate)) {
            rec.latestDate = d || null;
            rec.latestVal = v;
          }
        }
        rec.sum += v; rec.cnt += 1; if (!rec.unit && p?.unit) rec.unit = p.unit;
        byStation.set(sName, rec);
      }
    }

    const values = labels.map((s) => {
      const rec = byStation.get(s);
      if (!rec) return null;
      if (snapshot === 'latest') return (rec.latestVal != null ? rec.latestVal : (rec.cnt ? rec.sum / rec.cnt : null));
      return rec.cnt ? (rec.sum / rec.cnt) : null;
    });

    // Determine unit
    let unit = '';
    for (const rec of byStation.values()) { unit = rec.unit || unit; if (unit) break; }

    const datasets = [];
    datasets.push({
      label: snapshot === 'latest' ? 'Latest' : 'Mean',
      data: values,
      borderColor: 'rgba(59,130,246,1)',
      backgroundColor: 'rgba(59,130,246,0.6)',
      pointRadius: 3,
      pointHoverRadius: 4,
      tension: 0,
      spanGaps: false,
      showLine: false,
    });

    // Build simple threshold lines if present (use first encountered standard min/max across events)
    let tMin = null; let tMax = null; let stdLabel = null;
    outer: for (const ev of Array.isArray(events) ? events : []) {
      const sName = eventStationName(ev) || '';
      if (!labels.includes(sName)) continue;
      const results = Array.isArray(ev?.results) ? ev.results : [];
      for (const r of results) {
        const p = r?.parameter; if (!p) continue;
        const match = (String(p.code) === String(selectedParam)) || (String(p.id) === String(selectedParam)) || (String(r.parameter_id) === String(selectedParam));
        if (!match) continue;
        if (r?.threshold?.min_value != null && tMin == null) tMin = Number(r.threshold.min_value);
        if (r?.threshold?.max_value != null && tMax == null) tMax = Number(r.threshold.max_value);
        if (!stdLabel) stdLabel = r?.threshold?.standard?.code || r?.threshold?.standard?.name || null;
        if (tMin != null && tMax != null && stdLabel) break outer;
      }
    }
    const addConstLine = (val, label, color) => {
      if (val == null) return;
      datasets.push({
        label,
        data: labels.map(() => val),
        borderColor: color,
        backgroundColor: `${color}33`,
        borderDash: [4,4],
        pointRadius: 0,
        tension: 0,
        spanGaps: true,
      });
    };
    if (tMin != null) addConstLine(tMin, `${stdLabel || 'Standard'} – Min`, '#16a34a');
    if (tMax != null) addConstLine(tMax, `${stdLabel || 'Standard'} – Max`, '#ef4444');

    return { labels, datasets, unit };
  }, [events, JSON.stringify(selectedStations), selectedParam, snapshot, depthMode, JSON.stringify(paramOptions)]);
}
