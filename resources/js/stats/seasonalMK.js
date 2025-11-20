// Lightweight normal CDF loader with local fallback (Abramowitz–Stegun erf approx)
let _normalCdfFn = null;
async function getNormalCdf() {
  if (_normalCdfFn) return _normalCdfFn;
  try {
    const mod = await import('@stdlib/stats-base-dists-normal-cdf');
    const fn = mod?.default || mod;
    // Detect signature and wrap if needed
    try {
      const test = fn(0);
      if (Number.isFinite(test) && test > 0 && test < 1) {
        _normalCdfFn = fn;
      } else {
        const wrapped = (x) => fn(x, 0, 1);
        const t2 = wrapped(0);
        if (Number.isFinite(t2) && t2 > 0 && t2 < 1) {
          _normalCdfFn = wrapped;
        } else {
          throw new Error('unsupported cdf export');
        }
      }
    } catch {
      _normalCdfFn = null;
    }
    if (_normalCdfFn) return _normalCdfFn;
  } catch {}
  // Local approximation
  _normalCdfFn = (x) => {
    const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
    const sign = x < 0 ? -1 : 1;
    const z = Math.abs(x)/Math.SQRT2;
    const t = 1/(1+p*z);
    const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-z*z);
    const erf = sign * y;
    return 0.5 * (1 + erf);
  };
  return _normalCdfFn;
}

const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);

// (Legacy export retained; no longer used in regular MK flow.)
export const PAGASA = {
  seasonOf(){ return 'all'; },
  seasonYearOf(d){ return d.getFullYear(); },
};

// Build time series from monthly points for regular MK.
// Returns array [{ t: decimalYear, value }]. Decimal year = year + month/12
export function buildTimeSeriesFromMonthly(monthlyPoints){
  const out = [];
  for (const p of (monthlyPoints || [])){
    const d = p?.date instanceof Date ? p.date : (p?.date ? new Date(p.date) : null);
    const v = Number(p?.value);
    if (!d || !isFiniteNum(v)) continue;
    const t = d.getFullYear() + d.getMonth()/12; // coarse decimal year (mid-month not required)
    out.push({ t, value: v });
  }
  out.sort((a,b)=>a.t - b.t);
  return out;
}

// Regular MK over a full series [{ t, value }]
export function mkGeneral(series){
  const n = series.length;
  if (n < 2) return { n, S: 0, Var: 0, Z: 0, p_value: 1, direction: 'No trend', notes: ['Insufficient data'] };
  let S = 0;
  for (let i=0;i<n-1;i++){
    for (let j=i+1;j<n;j++){
      const diff = series[j].value - series[i].value;
      if (diff > 0) S += 1; else if (diff < 0) S -= 1;
    }
  }
  const vals = series.map(p=>p.value).slice().sort((a,b)=>a-b);
  let tieSum = 0; let i=0;
  while(i<vals.length){
    let j=i+1; while(j<vals.length && Math.abs(vals[j]-vals[i])<1e-12) j++;
    const t = j - i; if (t>1) tieSum += t*(t-1)*(2*t+5); i=j;
  }
  const Var = Math.max(0,(n*(n-1)*(2*n+5) - tieSum)/18);
  let Z = 0;
  if (Var > 0){
    if (S > 0) Z = (S - 1)/Math.sqrt(Var); else if (S < 0) Z = (S + 1)/Math.sqrt(Var); else Z = 0;
  }
  // p-value via normal approximation
  // getNormalCdf is async; caller will attach p-value and direction
  return { n, S, Var, Z };
}

// Legacy name retained: now performs regular MK on combined time series.
export async function seasonalMK(seasonSeries){
  // Combine any provided season arrays (for backward unit tests) into a flat series
  const wet = Array.isArray(seasonSeries?.wet) ? seasonSeries.wet : [];
  const dry = Array.isArray(seasonSeries?.dry) ? seasonSeries.dry : [];
  const combined = [];
  for (const p of [...wet, ...dry]){
    if (isFiniteNum(p?.value) && isFiniteNum(p?.year)) combined.push({ t: p.year, value: p.value });
  }
  combined.sort((a,b)=>a.t - b.t);
  const mk = mkGeneral(combined);
  const F = await getNormalCdf();
  const pTwo = mk.Var > 0 ? (2 * (1 - F(Math.abs(mk.Z)))) : 1;
  const direction = (pTwo < 0.05) ? (mk.Z > 0 ? 'Increasing' : (mk.Z < 0 ? 'Decreasing' : 'No trend')) : 'No trend';
  const notes = [];
  if (mk.n < 5) notes.push('Short record: results may be weak');
  return { S: mk.S, Var: mk.Var, Z: mk.Z, p_value: Math.max(0, Math.min(1, pTwo)), direction, n: mk.n, notes };
}

// Sen's slope on general time series [{t,value}]
export function sensSlopeGeneral(series){
  const nPts = series.length;
  if (nPts < 2) return { slope: 0, intercept: NaN, slopes: [] };
  const slopes = [];
  for (let i=0;i<nPts-1;i++){
    for (let j=i+1;j<nPts;j++){
      const dy = series[j].value - series[i].value;
      const dt = series[j].t - series[i].t;
      if (dt !== 0) slopes.push(dy/dt);
    }
  }
  if (!slopes.length) return { slope: 0, intercept: NaN, slopes: [] };
  const srt = slopes.slice().sort((a,b)=>a-b);
  const m = srt.length;
  const slope = (m % 2) ? srt[(m-1)/2] : (srt[m/2 - 1] + srt[m/2]) / 2;
  const regr = series.map(p => p.value - slope * p.t).filter(isFiniteNum).sort((a,b)=>a-b);
  const k = regr.length;
  const intercept = k ? ((k % 2) ? regr[(k-1)/2] : (regr[k/2 - 1] + regr[k/2]) / 2) : NaN;
  // Interpret slope relative to the time units used in `series.t`.
  // In the standard pipeline `buildTimeSeriesFromMonthly` uses decimal years (year + month/12),
  // so `slope` is by default in units-per-year. Provide explicit fields for clarity.
  const slope_per_year = slope; // legacy `slope` retained as per-year
  const slope_per_month = slope_per_year / 12;
  return { slope: slope_per_year, slope_per_year, slope_per_month, intercept, slopes: srt };
}

// Build monthly points from LakeView events, parameter and station filters
export function monthlyPointsFromEvents(events, { selectedParam, selectedStations = [] }){
  const pts = [];
  const add = (d, v) => pts.push({ date: d, value: v });
  for (const ev of (Array.isArray(events) ? events : [])){
    const d = ev?.sampled_at ? new Date(ev.sampled_at) : null;
    if (!d || isNaN(d)) continue;
    const sName = ev?.station?.name || ev?.station_name || '';
    if (selectedStations?.length && !selectedStations.includes(sName)) continue;
    const results = Array.isArray(ev?.results) ? ev.results : [];
    for (const r of results){
      const p = r?.parameter;
      if (!p) continue;
      const match = (String(p.code) === String(selectedParam)) || (String(p.id) === String(selectedParam)) || (String(r.parameter_id) === String(selectedParam));
      if (!match) continue;
      const v = Number(r.value);
      if (!isFiniteNum(v)) continue;
      add(d, v);
    }
  }
  // Collapse to monthly medians first (robust to multiple samples per month)
  const monthKey = (dt)=> `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
  const byMonth = new Map();
  for (const p of pts){
    const k = monthKey(p.date);
    const arr = byMonth.get(k) || [];
    arr.push(p.value);
    byMonth.set(k, arr);
  }
  const monthly = [];
  for (const [k, arr] of byMonth.entries()){
    const [y, m] = k.split('-').map(Number);
    const sorted = arr.slice().sort((a,b)=>a-b);
    const n = sorted.length;
    const med = (n % 2) ? sorted[(n-1)/2] : (sorted[n/2 - 1] + sorted[n/2]) / 2;
    monthly.push({ date: new Date(y, m-1, 15), value: med }); // 15th as center-of-month
  }
  // Sort
  monthly.sort((a,b)=> a.date - b.date);
  return monthly;
}

// Helper to produce overlay values aligned to chart labels
import { bucketSortKey as _bucketSortKey } from '../components/stats-modal/utils/chartUtils.js';

export function buildOverlayForLabels({ labels, bucket, slopePerYear, intercept }){
  if (!labels || !labels.length || !isFiniteNum(slopePerYear) || !isFiniteNum(intercept)) return Array(labels?.length || 0).fill(null);
  const parseLabelToDecimalYear = (label)=>{
    // label patterns: YYYY, YYYY-Q#, YYYY-MM
    const m = /^([0-9]{4})(?:-(?:Q([1-4])|([0-9]{2})))?$/.exec(label);
    if (!m) return null;
    const y = Number(m[1]);
    if (m[2]) { // quarter
      const q = Number(m[2]);
      return y + (q-1)/4; // start of quarter
    }
    if (m[3]) { // month
      const mo = Number(m[3]);
      return y + (mo-1)/12; // start of month
    }
    return y; // year
  };
  return labels.map(lab => {
    const t = parseLabelToDecimalYear(lab);
    if (t == null) return null;
    return intercept + slopePerYear * t;
  });
}

// High-level: compute regular MK + Sen slope and overlay.
export async function computeSMKFromEvents({ events, selectedParam, selectedStations, labels, bucket, alpha = 0.05 }){
  const monthly = monthlyPointsFromEvents(events, { selectedParam, selectedStations });
  const timeSeries = buildTimeSeriesFromMonthly(monthly);
  const mkRaw = mkGeneral(timeSeries);
  const F = await getNormalCdf();
  const pTwo = mkRaw.Var > 0 ? (2 * (1 - F(Math.abs(mkRaw.Z)))) : 1;
  const mk = { ...mkRaw, p_value: Math.max(0, Math.min(1, pTwo)), direction: (pTwo < alpha) ? (mkRaw.Z > 0 ? 'Increasing' : (mkRaw.Z < 0 ? 'Decreasing' : 'No trend')) : 'No trend' };
  const sen = sensSlopeGeneral(timeSeries);
  const overlay = buildOverlayForLabels({ labels, bucket, slopePerYear: sen.slope, intercept: sen.intercept });
  const status = mk.direction;
  // Provide legacy seasonSeries structure (empty) for UI compatibility
  const seasonSeries = { wet: [], dry: [] };
  return { seasonSeries, timeSeries, mk, sen, overlay, alpha, status };
}

// Export helper for unit testing (legacy signature). Performs regular MK over combined seasons.
export function computeSMKFromSeasonSeries(seasonSeries){
  return seasonalMK(seasonSeries);
}
