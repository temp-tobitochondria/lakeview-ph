import { useMemo } from 'react';
import { eventStationName, parseIsoDate } from '../utils/dataUtils';

export default function useCorrelationData({ events, station = '', paramX, paramY, depthMode = 'surface', paramOptions = [] }) {
  return useMemo(() => {
    if (!station || !paramX || !paramY || String(paramX) === String(paramY)) return { datasets: [], unitX: '', unitY: '', meta: {} };

    const isSurface = (d) => {
      if (d == null) return true;
      const n = Number(d);
      if (!Number.isFinite(n)) return depthMode !== 'surface';
      return depthMode === 'surface' ? Math.abs(n) <= 0.25 : true;
    };

    const points = [];
    let unitX = ''; let unitY = '';
    for (const ev of Array.isArray(events) ? events : []) {
      const sName = eventStationName(ev) || '';
      if (sName !== station) continue;
      let x = null; let y = null; let ux = ''; let uy = '';
      const results = Array.isArray(ev?.results) ? ev.results : [];
      for (const r of results) {
        const p = r?.parameter; if (!p) continue;
        if (!isSurface(r?.depth_m)) continue;
        const v = Number(r?.value); if (!Number.isFinite(v)) continue;
        const pidMatchX = (String(p.code) === String(paramX)) || (String(p.id) === String(paramX)) || (String(r.parameter_id) === String(paramX));
        const pidMatchY = (String(p.code) === String(paramY)) || (String(p.id) === String(paramY)) || (String(r.parameter_id) === String(paramY));
        if (pidMatchX) { x = v; ux = p?.unit || ux; }
        if (pidMatchY) { y = v; uy = p?.unit || uy; }
      }
      if (x != null && y != null) {
        points.push({ x, y });
        unitX = unitX || ux;
        unitY = unitY || uy;
      }
    }

    // Optional simple linear regression (least squares) for trend line and R^2
    let regression = null; let r2 = null;
    if (points.length >= 3) {
      const n = points.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
      for (const pt of points) { sumX += pt.x; sumY += pt.y; sumXY += pt.x * pt.y; sumXX += pt.x * pt.x; sumYY += pt.y * pt.y; }
      const denom = (n * sumXX - sumX * sumX);
      if (denom !== 0) {
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        regression = { slope, intercept };
        // R^2
        const meanY = sumY / n;
        let ssTot = 0, ssRes = 0;
        for (const pt of points) { const yhat = slope * pt.x + intercept; ssTot += (pt.y - meanY) ** 2; ssRes += (pt.y - yhat) ** 2; }
        r2 = ssTot ? (1 - ssRes / ssTot) : null;
      }
    }

    const datasets = [];
    datasets.push({ label: 'Samples', data: points, showLine: false, borderColor: 'rgba(59,130,246,1)', backgroundColor: 'rgba(59,130,246,0.5)', pointRadius: 3, parsing: false });
    if (regression) {
      // Build line across min..max x
      const xs = points.map(p => p.x);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const p1 = { x: minX, y: regression.slope * minX + regression.intercept };
      const p2 = { x: maxX, y: regression.slope * maxX + regression.intercept };
      datasets.push({ label: `Trend${typeof r2 === 'number' ? ` (R²=${r2.toFixed(2)})` : ''}`, data: [p1, p2], showLine: true, spanGaps: true, borderColor: '#f59e0b', backgroundColor: 'transparent', pointRadius: 0, parsing: false });
    }

    return { datasets, unitX, unitY, meta: { n: points.length, r2 } };
  }, [events, station, paramX, paramY, depthMode, JSON.stringify(paramOptions)]);
}
