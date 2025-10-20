import React, { useEffect, useMemo, useState, useRef, useImperativeHandle } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import { FiActivity, FiBarChart2, FiInfo } from "react-icons/fi";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);
import { apiPublic, buildQuery } from "../../lib/api";
import { fetchParameters } from "./data/fetchers";
import Popover from "../common/Popover";
import InfoModal from "../common/InfoModal";
import { buildGraphExplanation } from "../utils/graphExplain";

function CompareLake({
  lakeOptions = [],
  params = [],
  thresholds = {},
  chartOptions = {},
  bucket = "month",
  chartRef,
  timeRange = "all",
  dateFrom = "",
  dateTo = "",
  onParamChange = () => {},
}, ref) {
  const [lakeA, setLakeA] = useState("");
  const [lakeB, setLakeB] = useState("");
  const [selectedOrgA, setSelectedOrgA] = useState("");
  const [selectedOrgB, setSelectedOrgB] = useState("");
  const [selectedStationsA, setSelectedStationsA] = useState([]);
  const [selectedStationsB, setSelectedStationsB] = useState([]);
  const [selectedParam, setSelectedParam] = useState("");
  const [stationsOpenA, setStationsOpenA] = useState(false);
  const [stationsOpenB, setStationsOpenB] = useState(false);
  const stationBtnARef = useRef(null);
  const stationBtnBRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [eventsA, setEventsA] = useState([]);
  const [eventsB, setEventsB] = useState([]);
  const [orgCacheA, setOrgCacheA] = useState([]);
  const [orgCacheB, setOrgCacheB] = useState([]);
  const [stationCacheA, setStationCacheA] = useState({ all: [], byOrg: {} });
  const [stationCacheB, setStationCacheB] = useState({ all: [], byOrg: {} });
  const [localParams, setLocalParams] = useState([]);
  const [applied, setApplied] = useState(false);
  const [summaryA, setSummaryA] = useState({ n: 0, mean: NaN, median: NaN });
  const [summaryB, setSummaryB] = useState({ n: 0, mean: NaN, median: NaN });
  const [viewMode, setViewMode] = useState('time'); // 'time' | 'depth'
  const [seriesMode, setSeriesMode] = useState('avg'); // 'avg' | 'per-station'
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoContent, setInfoContent] = useState({ title: '', sections: [] });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const eventStationName = (ev) => ev?.station?.name || ev?.station_name || ((ev?.latitude != null && ev?.longitude != null) ? `${Number(ev.latitude).toFixed(6)}, ${Number(ev.longitude).toFixed(6)}` : null);
  const nameForLake = (lk) => {
    if (!lk) return '';
    try {
      const found = lakeOptions.find((x) => String(x.id) === String(lk));
      return found ? found.name : String(lk);
    } catch (e) {
      return String(lk);
    }
  };
  const classForLake = (lk) => {
    if (!lk) return '';
    try {
      const f = lakeOptions.find((x) => String(x.id) === String(lk));
      return f?.class_code || f?.class || f?.water_class || f?.classification || '';
    } catch { return ''; }
  };

  // Parameters
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (params && params.length) { setLocalParams(params); return; }
      try { const list = await fetchParameters(); if (!aborted) setLocalParams(list); }
      catch { if (!aborted) setLocalParams([]); }
    })();
    return () => { aborted = true; };
  }, [params]);
  const paramList = useMemo(() => (params && params.length ? params : localParams), [params, localParams]);

  // Fetch events for each lake (similar to WaterQualityTab)
  useEffect(() => {
    let aborted = false;
    const fmtIso = (d) => { if (!d) return ""; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; };
    const fetchFor = async (lk, orgId) => {
      if (!lk) return [];
      // Always fetch generously and perform relative-range anchoring client-side.
      const lim = 5000;
      let fromEff, toEff;
      if (timeRange === 'custom') { fromEff = dateFrom || undefined; toEff = dateTo || undefined; }
      else { fromEff = undefined; toEff = undefined; }
      const qs = buildQuery({ lake_id: lk, organization_id: orgId || undefined, sampled_from: fromEff, sampled_to: toEff, limit: lim });
      const res = await apiPublic(`/public/sample-events${qs}`);
      return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    };
    (async () => {
      try {
        setLoading(true);
        const [a,b] = await Promise.all([ fetchFor(lakeA, selectedOrgA), fetchFor(lakeB, selectedOrgB) ]);
        if (!aborted) { setEventsA(a); setEventsB(b); }
      } catch { if (!aborted) { setEventsA([]); setEventsB([]); } }
      finally { if (!aborted) setLoading(false); }
    })();
    return () => { aborted = true; };
  }, [lakeA, lakeB, selectedOrgA, selectedOrgB, timeRange, dateFrom, dateTo]);

  // Cache org + stations for A
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!lakeA) { setOrgCacheA([]); setStationCacheA({ all: [], byOrg: {} }); return; }
      try {
        const qs = buildQuery({ lake_id: lakeA, limit: 2000 });
        let res;
        try { res = await apiPublic(`/public/sample-events${qs}`); }
        catch (e) { if (e?.status === 429) { await sleep(600); res = await apiPublic(`/public/sample-events${qs}`); } else throw e; }
        const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const orgMap = new Map(); const allStations = new Set(); const byOrg = new Map();
        rows.forEach((ev) => {
          const oid = ev.organization_id ?? ev.organization?.id ?? null;
          const oname = ev.organization_name ?? ev.organization?.name ?? null;
          if (oid && oname && !orgMap.has(String(oid))) orgMap.set(String(oid), { id: oid, name: oname });
          const stationName = ev?.station?.name || ev?.station_name || (ev.latitude != null && ev.longitude != null ? `${Number(ev.latitude).toFixed(6)}, ${Number(ev.longitude).toFixed(6)}` : "");
          const label = stationName || "";
          if (label) {
            allStations.add(label);
            if (oid) { const k = String(oid); if (!byOrg.has(k)) byOrg.set(k, new Set()); byOrg.get(k).add(label); }
          }
        });
        if (!aborted) {
          setOrgCacheA(Array.from(orgMap.values()));
          const byOrgObj = {}; for (const [k,v] of byOrg.entries()) byOrgObj[k] = Array.from(v.values());
          setStationCacheA({ all: Array.from(allStations.values()), byOrg: byOrgObj });
        }
      } catch { if (!aborted) { setOrgCacheA([]); setStationCacheA({ all: [], byOrg: {} }); } }
    })();
    return () => { aborted = true; };
  }, [lakeA]);

  // Cache org + stations for B
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!lakeB) { setOrgCacheB([]); setStationCacheB({ all: [], byOrg: {} }); return; }
      try {
        const qs = buildQuery({ lake_id: lakeB, limit: 2000 });
        let res;
        try { res = await apiPublic(`/public/sample-events${qs}`); }
        catch (e) { if (e?.status === 429) { await sleep(600); res = await apiPublic(`/public/sample-events${qs}`); } else throw e; }
        const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const orgMap = new Map(); const allStations = new Set(); const byOrg = new Map();
        rows.forEach((ev) => {
          const oid = ev.organization_id ?? ev.organization?.id ?? null;
          const oname = ev.organization_name ?? ev.organization?.name ?? null;
          if (oid && oname && !orgMap.has(String(oid))) orgMap.set(String(oid), { id: oid, name: oname });
          const stationName = ev?.station?.name || ev?.station_name || (ev.latitude != null && ev.longitude != null ? `${Number(ev.latitude).toFixed(6)}, ${Number(ev.longitude).toFixed(6)}` : "");
          const label = stationName || "";
          if (label) {
            allStations.add(label);
            if (oid) { const k = String(oid); if (!byOrg.has(k)) byOrg.set(k, new Set()); byOrg.get(k).add(label); }
          }
        });
        if (!aborted) {
          setOrgCacheB(Array.from(orgMap.values()));
          const byOrgObj = {}; for (const [k,v] of byOrg.entries()) byOrgObj[k] = Array.from(v.values());
          setStationCacheB({ all: Array.from(allStations.values()), byOrg: byOrgObj });
        }
      } catch { if (!aborted) { setOrgCacheB([]); setStationCacheB({ all: [], byOrg: {} }); } }
    })();
    return () => { aborted = true; };
  }, [lakeB]);

  const orgOptionsA = useMemo(() => orgCacheA, [orgCacheA]);
  const orgOptionsB = useMemo(() => orgCacheB, [orgCacheB]);
  const stationsA = useMemo(() => (!selectedOrgA ? (stationCacheA.all || []) : (stationCacheA.byOrg?.[String(selectedOrgA)] || [])), [selectedOrgA, stationCacheA]);
  const stationsB = useMemo(() => (!selectedOrgB ? (stationCacheB.all || []) : (stationCacheB.byOrg?.[String(selectedOrgB)] || [])), [selectedOrgB, stationCacheB]);

  const isComplete = useMemo(() => {
    const hasLake = Boolean(lakeA || lakeB);
    const hasParam = Boolean(selectedParam);
    const hasStations = (!lakeA || (selectedStationsA && selectedStationsA.length)) && (!lakeB || (selectedStationsB && selectedStationsB.length));
    return hasLake && hasParam && hasStations;
  }, [lakeA, lakeB, selectedParam, selectedStationsA, selectedStationsB]);

  // Controls whether the parameter select should be enabled. Parameter selection
  // requires that for every selected lake, the dataset source and at least one
  // location are chosen. If only one lake is selected, only that lake's fields
  // are required.
  const canChooseParam = useMemo(() => {
    const lakes = [ { lake: lakeA, org: selectedOrgA, stations: selectedStationsA }, { lake: lakeB, org: selectedOrgB, stations: selectedStationsB } ];
    // If no lake selected, cannot choose param
    if (!lakes.some(l => l.lake)) return false;
    for (const l of lakes) {
      if (!l.lake) continue; // lake not selected -> skip
      if (!l.org) return false; // dataset source required
      if (!Array.isArray(l.stations) || l.stations.length === 0) return false; // at least one location required
    }
    return true;
  }, [lakeA, lakeB, selectedOrgA, selectedOrgB, selectedStationsA, selectedStationsB]);

  // Helper to compute missing fields to show to the user
  const computeMissingFields = () => {
    const missing = [];
    if (!lakeA && !lakeB) { missing.push('Select at least one lake (Lake A or Lake B)'); return missing; }
    const check = (label, lake, org, stations) => {
      if (!lake) return;
      if (!org) missing.push(`${label}: Dataset source`);
      if (!stations || stations.length === 0) missing.push(`${label}: Locations`);
    };
    check('Lake A', lakeA, selectedOrgA, selectedStationsA);
    check('Lake B', lakeB, selectedOrgB, selectedStationsB);
    if (!selectedParam) missing.push('Parameter');
    return missing;
  };

  const handleApply = async () => {
    const missing = computeMissingFields();
    if (missing.length) {
      // If the single missing message is the 'select at least one lake' hint,
      // render that directly.
      if (missing.length === 1 && /^Select at least one lake/i.test(missing[0])) {
        const sentence = `Please select at least one lake (Lake A or Lake B).`;
        try {
          const Swal = (await import('sweetalert2')).default;
          Swal.fire({ icon: 'warning', title: 'Missing fields', html: `<div style="text-align:left; white-space:normal; word-break:break-word; font-size:13px">${sentence}</div>`, width: 560, showCloseButton: true });
        } catch (e) { window.alert(sentence); }
        return;
      }

      // Group missing items by lake and parameter, then build a natural phrase.
      const lakeMissing = { A: [], B: [] };
      let paramMissing = false;
      missing.forEach((m) => {
        if (/^Lake A:/i.test(m)) lakeMissing.A.push(m.replace(/^Lake A:\s*/i, ''));
        else if (/^Lake B:/i.test(m)) lakeMissing.B.push(m.replace(/^Lake B:\s*/i, ''));
        else if (/^Parameter$/i.test(m)) paramMissing = true;
      });

      const mapToken = (tok) => {
        if (/dataset source/i.test(tok)) return 'a dataset source';
        if (/locations?/i.test(tok)) return 'at least one location';
        return tok.toLowerCase();
      };

      const clauses = [];
      if (lakeMissing.A.length) clauses.push(`choose ${lakeMissing.A.map(mapToken).join(' and ')} for Lake A`);
      if (lakeMissing.B.length) clauses.push(`choose ${lakeMissing.B.map(mapToken).join(' and ')} for Lake B`);
      if (paramMissing) clauses.push('select a parameter');

      const sentence = `Please ${clauses.join('; ')}.`;
      try {
        const Swal = (await import('sweetalert2')).default;
        Swal.fire({ icon: 'warning', title: 'Missing fields', html: `<div style="text-align:left; white-space:normal; word-break:break-word; font-size:13px">${sentence}</div>`, width: 560, showCloseButton: true });
      } catch (e) { window.alert(sentence); }
      return;
    }
    setApplied(true);
  };

  useEffect(() => { setApplied(false); }, [lakeA, lakeB, selectedOrgA, selectedOrgB, selectedStationsA, selectedStationsB, selectedParam, timeRange, dateFrom, dateTo, bucket]);
  // reset summaries when selections change
  useEffect(() => { if (!applied) { setSummaryA({ n: 0, mean: NaN, median: NaN }); setSummaryB({ n: 0, mean: NaN, median: NaN }); } }, [lakeA, lakeB, selectedOrgA, selectedOrgB, selectedStationsA, selectedStationsB, selectedParam, timeRange, dateFrom, dateTo, bucket, applied]);

  // local stat helpers
  const _mean = (arr) => { const a = (Array.isArray(arr) ? arr.filter(Number.isFinite) : []); if (!a.length) return NaN; return a.reduce((s,v)=>s+v,0)/a.length; };
  const _median = (arr) => { const a = (Array.isArray(arr) ? arr.filter(Number.isFinite) : []); if (!a.length) return NaN; const s = a.slice().sort((x,y)=>x-y); const n = s.length; const m = Math.floor(n/2); return (n%2) ? s[m] : (s[m-1]+s[m])/2; };

  useEffect(() => {
    if (!applied) return;
    try {
      // Compute for A
      const valsA = [];
      for (const ev of eventsA || []) {
        const oidEv = ev.organization_id ?? ev.organization?.id ?? null;
        if (selectedOrgA && oidEv && String(oidEv) !== String(selectedOrgA)) continue;
        if (selectedStationsA && selectedStationsA.length) { const nm = eventStationName(ev) || ''; if (!selectedStationsA.includes(nm)) continue; }
        const results = Array.isArray(ev?.results) ? ev.results : [];
        for (const r of results) {
          const p = r?.parameter; if (!p) continue;
          const match = (String(p.code) === String(selectedParam)) || (String(p.id) === String(selectedParam)) || (String(r.parameter_id) === String(selectedParam));
          if (!match) continue;
          const v = Number(r.value); if (!Number.isFinite(v)) continue;
          valsA.push(v);
        }
      }
      setSummaryA({ n: valsA.length, mean: _mean(valsA), median: _median(valsA) });
      // Compute for B
      const valsB = [];
      for (const ev of eventsB || []) {
        const oidEv = ev.organization_id ?? ev.organization?.id ?? null;
        if (selectedOrgB && oidEv && String(oidEv) !== String(selectedOrgB)) continue;
        if (selectedStationsB && selectedStationsB.length) { const nm = eventStationName(ev) || ''; if (!selectedStationsB.includes(nm)) continue; }
        const results = Array.isArray(ev?.results) ? ev.results : [];
        for (const r of results) {
          const p = r?.parameter; if (!p) continue;
          const match = (String(p.code) === String(selectedParam)) || (String(p.id) === String(selectedParam)) || (String(r.parameter_id) === String(selectedParam));
          if (!match) continue;
          const v = Number(r.value); if (!Number.isFinite(v)) continue;
          valsB.push(v);
        }
      }
      setSummaryB({ n: valsB.length, mean: _mean(valsB), median: _median(valsB) });
    } catch (e) {
      setSummaryA({ n: 0, mean: NaN, median: NaN });
      setSummaryB({ n: 0, mean: NaN, median: NaN });
    }
  }, [applied]);

  const chartData = useMemo(() => {
    const selected = selectedParam;
    const lakesToRender = [lakeA, lakeB].filter(Boolean);
    if (!selected || lakesToRender.length === 0) return null;
    const parseDate = (iso) => { try { return new Date(iso); } catch { return null; } };
    const bucketKey = (d, mode) => {
      if (!d) return null; const y = d.getFullYear(); const m = d.getMonth()+1; const q=Math.floor((m-1)/3)+1;
      if (mode==='year') return `${y}`; if (mode==='quarter') return `${y}-Q${q}`; return `${y}-${String(m).padStart(2,'0')}`;
    };
    const bucketSortKey = (k) => { if (!k) return 0; const m=/^([0-9]{4})(?:-(?:Q([1-4])|([0-9]{2})))?$/.exec(k); if(!m) return 0; const y=Number(m[1]); const q=m[2]?(Number(m[2])*3):0; const mo=m[3]?Number(m[3]):0; return y*12+(q||mo); };
  const lakeMaps = new Map(); const perStationMaps = {}; // thresholds now tracked per-lake & per-standard
    const thByLakeAndStandard = new Map(); // lakeId -> Map(stdKey -> { stdLabel, min, max, buckets:Set })
    const ensureStdEntry = (lkKey, stdKey, stdLabel) => {
      if (!thByLakeAndStandard.has(lkKey)) thByLakeAndStandard.set(lkKey, new Map());
      const inner = thByLakeAndStandard.get(lkKey);
      if (!inner.has(stdKey)) inner.set(stdKey, { stdLabel: stdLabel || `Standard ${stdKey}`, min: null, max: null, buckets: new Set() });
      return inner.get(stdKey);
    };
    const process = (lakeId, arr, stationsSel, orgSel) => {
      for (const ev of arr||[]) {
        const oidEv = ev.organization_id ?? ev.organization?.id ?? null;
        if (orgSel && oidEv && String(oidEv) !== String(orgSel)) continue;
        if (stationsSel && stationsSel.length) { const nm = eventStationName(ev) || ''; if (!stationsSel.includes(nm)) continue; }
        const d = parseDate(ev.sampled_at); const bk=bucketKey(d,bucket); if(!bk) continue;
        const results = Array.isArray(ev?.results)?ev.results:[];
        for (const r of results) {
          const p=r?.parameter; if(!p) continue;
          const match=(String(p.code)===String(selected))||(String(p.id)===String(selected))||(String(r.parameter_id)===String(selected));
          if(!match) continue;
          const v=Number(r.value); if(!Number.isFinite(v)) continue;
          const key=String(lakeId); if(!lakeMaps.has(key)) lakeMaps.set(key,new Map());
          const m=lakeMaps.get(key); const agg=m.get(bk)||{sum:0,cnt:0}; agg.sum+=v; agg.cnt+=1; m.set(bk,agg);
          // per-station maps
          try {
            const nm = eventStationName(ev) || '';
            if (!perStationMaps[key]) perStationMaps[key] = new Map();
            const lakeMap = perStationMaps[key];
            const stMap = lakeMap.get(nm) || new Map();
            const aggS = stMap.get(bk) || { sum:0, cnt:0 };
            aggS.sum += v; aggS.cnt += 1; stMap.set(bk, aggS); lakeMap.set(nm, stMap);
          } catch (e) { /* noop */ }
          // thresholds by standard for this lake (key by standard code)
          const stdId = r?.threshold?.standard_id ?? ev?.applied_standard_id ?? null;
          const stdKey = r?.threshold?.standard?.code || r?.threshold?.standard?.name || (stdId != null ? String(stdId) : null);
          const stdLabel = stdKey;
          if (stdKey != null && (r?.threshold?.min_value != null || r?.threshold?.max_value != null)) {
            const entry = ensureStdEntry(key, String(stdKey), stdLabel);
            if (r?.threshold?.min_value != null) entry.min = Number(r.threshold.min_value);
            if (r?.threshold?.max_value != null) entry.max = Number(r.threshold.max_value);
            entry.buckets.add(bk);
          }
        }
      }
    };
    // For relative time ranges (e.g., 1y, 5y, 6mo), anchor them to the latest sample date per-lake
    const anchoredFilter = (arr) => {
      if (!arr || !arr.length) return [];
      if (timeRange === 'custom' || timeRange === 'all') return arr;
      // find latest sampled_at in array
      const parseDate = (iso) => { try { return new Date(iso); } catch { return null; } };
      const allDates = arr.map((e) => parseDate(e?.sampled_at)).filter((d) => d && !isNaN(d));
      if (!allDates.length) return [];
      const latest = new Date(Math.max(...allDates));
      const from = new Date(latest);
      if (timeRange === '5y') from.setFullYear(from.getFullYear() - 5);
      else if (timeRange === '3y') from.setFullYear(from.getFullYear() - 3);
      else if (timeRange === '1y') from.setFullYear(from.getFullYear() - 1);
      else if (timeRange === '6mo') from.setMonth(from.getMonth() - 6);
      return arr.filter((e) => {
        const d = parseDate(e?.sampled_at);
        return d && d >= from && d <= latest;
      });
    };

    const eventsAFiltered = anchoredFilter(eventsA);
    const eventsBFiltered = anchoredFilter(eventsB);

    process(lakeA, eventsAFiltered, selectedStationsA, selectedOrgA);
    process(lakeB, eventsBFiltered, selectedStationsB, selectedOrgB);
    const labelSet=new Set(); for(const m of lakeMaps.values()) for(const k of m.keys()) labelSet.add(k);
    const labels=Array.from(labelSet).sort((a,b)=>bucketSortKey(a)-bucketSortKey(b));
  const datasets=[];
    // Build per-lake depth-band maps while processing so we can optionally render one line per depth
    // depthBandsByLake: lakeKey -> Map(depthKey -> Map(bucket -> {sum,cnt}))
    const depthBandsByLake = new Map();
    // (we populated lakeMaps and perStationMaps earlier; need to re-walk events to collect depth bands per-lake)
    const collectDepthsFor = (lakeId, arr, stationsSel, orgSel) => {
      if (!lakeId) return;
      const lkKey = String(lakeId);
      if (!depthBandsByLake.has(lkKey)) depthBandsByLake.set(lkKey, new Map());
      const mapForLake = depthBandsByLake.get(lkKey);
      for (const ev of arr||[]) {
        const oidEv = ev.organization_id ?? ev.organization?.id ?? null;
        if (orgSel && oidEv && String(oidEv) !== String(orgSel)) continue;
        const sName = eventStationName(ev) || '';
        if (stationsSel && stationsSel.length && !stationsSel.includes(sName)) continue;
        const d = parseDate(ev.sampled_at); const bk=bucketKey(d,bucket); if(!bk) continue;
        const results = Array.isArray(ev?.results)?ev.results:[];
        for (const r of results) {
          const p = r?.parameter; if(!p) continue;
          const match = (String(p.code)===String(selected))||(String(p.id)===String(selected))||(String(r.parameter_id)===String(selected));
          if(!match) continue;
          if (r?.depth_m == null) continue;
          const dk = String(Math.round(Number(r.depth_m)));
          if (!mapForLake.has(dk)) mapForLake.set(dk, new Map());
          const band = mapForLake.get(dk);
          const agg = band.get(bk) || { sum:0, cnt:0 };
          const v = Number(r.value); if (!Number.isFinite(v)) continue;
          agg.sum += v; agg.cnt += 1; band.set(bk, agg);
        }
      }
    };
    collectDepthsFor(lakeA, eventsAFiltered, selectedStationsA, selectedOrgA);
    collectDepthsFor(lakeB, eventsBFiltered, selectedStationsB, selectedOrgB);
    // If a lake has no explicit depth bands but has data, assume depth 0 m by using overall series
    const ensureZeroDepthIfMissing = (lk) => {
      if (!lk) return;
      const lkKey = String(lk);
      const depthMap = depthBandsByLake.get(lkKey) || new Map();
      const seriesMap = lakeMaps.get(lkKey) || new Map();
      if (depthMap.size === 0 && seriesMap.size > 0) {
        const band = new Map();
        for (const [lb, agg] of seriesMap.entries()) band.set(lb, { sum: agg.sum, cnt: agg.cnt });
        depthMap.set('0', band);
        depthBandsByLake.set(lkKey, depthMap);
      }
    };
    ensureZeroDepthIfMissing(lakeA);
    ensureZeroDepthIfMissing(lakeB);

    // If depth bands exist (for either lake) and we're showing averages, render a series per depth (per-lake)
  const hasDepthSeries = Array.from(depthBandsByLake.values()).some((m) => (m && m.size > 0));
  // Use more distinct palettes per lake for better differentiation on dark background
  const depthColorsA = ['#2563EB', '#059669', '#14B8A6', '#10B981', '#06B6D4', '#0EA5E9', '#22C55E', '#2DD4BF']; // blues/greens/teals
  const depthColorsB = ['#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#EC4899', '#A855F7', '#FB7185', '#EAB308']; // oranges/reds/purples
    if (seriesMode === 'avg' && hasDepthSeries) {
      // push per-lake, per-depth series
      lakesToRender.forEach((lk, li) => {
        const lakeKey = String(lk);
        const lakeDepthMap = depthBandsByLake.get(lakeKey) || new Map();
        const depthKeys = Array.from(lakeDepthMap.keys()).filter((k) => k !== 'NA').sort((a,b) => Number(a) - Number(b));
        let di = 0;
        for (const dk of depthKeys) {
          const bandMap = lakeDepthMap.get(dk) || new Map();
          const data = labels.map((lb) => { const agg = bandMap.get(lb); return agg && agg.cnt ? (agg.sum/agg.cnt) : null; });
          const palette = li === 0 ? depthColorsA : depthColorsB;
          const pointStyle = li === 0 ? 'circle' : 'triangle';
          datasets.push({ label: `${nameForLake(lk) || String(lk)} — ${dk} m`, data, borderColor: palette[di % palette.length], backgroundColor: 'transparent', pointRadius: 3, pointStyle, pointHoverRadius: 4, borderWidth: 2.5, tension: 0.2, spanGaps: true });
          di++;
        }
      });
    } else {
      // Fallback: existing behavior (per-station or per-lake avg)
      lakesToRender.forEach((lk,i)=>{
        if (seriesMode === 'per-station') {
          const lakeKey = String(lk);
          const lakeStationMap = perStationMaps[lakeKey] || new Map();
          let si = 0;
          for (const [stationName, map] of lakeStationMap.entries()) {
            const data = labels.map((lb)=>{ const agg=map.get(lb); return agg&&agg.cnt?(agg.sum/agg.cnt):null; });
            datasets.push({ label: `${lakeOptions.find((x)=>String(x.id)===String(lk))?.name || String(lk)} — ${stationName}`, data, borderColor: `hsl(${(si*50)%360} 80% 60%)`, backgroundColor: 'transparent', pointRadius:2, pointHoverRadius:4, tension:0.15, spanGaps: true });
            si++;
          }
        } else {
          const seriesMap = lakeMaps.get(String(lk)) || new Map();
          const data = labels.map((lb)=>{ const agg=seriesMap.get(lb); return agg&&agg.cnt?(agg.sum/agg.cnt):null; });
          datasets.push({ label: lakeOptions.find((x)=>String(x.id)===String(lk))?.name || String(lk), data, borderColor: i===0?'rgba(59,130,246,1)':`hsl(${(i*70)%360} 80% 60%)`, backgroundColor: i===0?'rgba(59,130,246,0.2)':`hsl(${(i*70)%360} 80% 60% / 0.2)`, pointRadius:3, pointHoverRadius:4, tension:0.2, spanGaps: true });
        }
      });
    }
    // Build unified threshold lines: if both lakes use the same standard, draw a single line for it
    // Combine standards across lakes but only when the threshold values (min/max)
    // are identical. If two lakes have the same standard but different min/max
    // values, render them separately so each class' thresholds are visible.
    const combinedStandards = new Map(); // uniqueKey -> { stdLabel, min, max, buckets:Set, lakes:Set<string>, stdKey }
    lakesToRender.forEach((lk) => {
      const lkKey = String(lk);
      const inner = thByLakeAndStandard.get(lkKey);
      if (!inner) return;
      inner.forEach((entry, stdKey) => {
        const minVal = entry.min != null ? Number(entry.min) : null;
        const maxVal = entry.max != null ? Number(entry.max) : null;
        const uniqueKey = `${stdKey}::${minVal ?? 'null'}::${maxVal ?? 'null'}`;
        if (!combinedStandards.has(uniqueKey)) combinedStandards.set(uniqueKey, { stdLabel: entry.stdLabel, min: minVal, max: maxVal, buckets: new Set(entry.buckets), lakes: new Set([lkKey]), stdKey });
        else {
          const e = combinedStandards.get(uniqueKey);
          // min/max are identical by construction of uniqueKey; merge buckets and lakes
          entry.buckets.forEach((b) => e.buckets.add(b));
          e.lakes.add(lkKey);
        }
      });
    });

  // Unified colors when min/max are identical across lakes
  const minColorUnified = '#16a34a';
  const maxColorUnified = '#ef4444';
  // Per-lake min/max colors for distinct thresholds
  // Lake A: Min = green, Max = red
  // Lake B: Min = yellow, Max = orange
  const lakeMinColors = ['#16a34a', '#f59e0b']; // Lake A min (green), Lake B min (yellow/orange)
  const lakeMaxColors = ['#ef4444', '#f97316']; // Lake A max (red), Lake B max (orange)

    combinedStandards.forEach((entry) => {
      if (entry.lakes.size > 1) {
        // Unified line; include each lake's class in the label
        const lakesMeta = Array.from(entry.lakes).map((lkKey) => {
          const nm = nameForLake(lkKey);
          const cls = classForLake(lkKey);
          return `${nm}${cls ? `: Class ${cls}` : ''}`;
        }).join(', ');
        if (entry.min != null) {
          const data = labels.map((lb) => entry.buckets.has(lb) ? entry.min : null);
          datasets.push({ label: `${entry.stdLabel} – Min (${lakesMeta})`, data, borderColor: minColorUnified, backgroundColor: `${minColorUnified}33`, borderDash: [4,4], pointRadius: 0, tension: 0, spanGaps: true });
        }
        if (entry.max != null) {
          const data = labels.map((lb) => entry.buckets.has(lb) ? entry.max : null);
          datasets.push({ label: `${entry.stdLabel} – Max (${lakesMeta})`, data, borderColor: maxColorUnified, backgroundColor: `${maxColorUnified}33`, borderDash: [4,4], pointRadius: 0, tension: 0, spanGaps: true });
        }
      } else {
        // Only present in one lake (or same values grouped under uniqueKey); render per-lake threshold line for that lake
        const onlyLakeKey = Array.from(entry.lakes)[0];
        const li = lakesToRender.findIndex((lk) => String(lk) === onlyLakeKey);
        const minColor = lakeMinColors[li % lakeMinColors.length];
        const maxColor = lakeMaxColors[li % lakeMaxColors.length];
        const lakeLabel = lakeOptions.find((x)=>String(x.id)===onlyLakeKey)?.name || onlyLakeKey;
        const cls = classForLake(onlyLakeKey);
        if (entry.min != null) {
          const data = labels.map((lb) => entry.buckets.has(lb) ? entry.min : null);
          datasets.push({ label: `${lakeLabel}${cls ? ` – Class ${cls}` : ''} – ${entry.stdLabel} – Min`, data, borderColor: minColor, backgroundColor: `${minColor}33`, borderDash: [4,4], pointRadius: 0, tension: 0, spanGaps: true });
        }
        if (entry.max != null) {
          const data = labels.map((lb) => entry.buckets.has(lb) ? entry.max : null);
          datasets.push({ label: `${lakeLabel}${cls ? ` – Class ${cls}` : ''} – ${entry.stdLabel} – Max`, data, borderColor: maxColor, backgroundColor: `${maxColor}33`, borderDash: [4,4], pointRadius: 0, tension: 0, spanGaps: true });
        }
      }
    });
    return { labels, datasets };
  }, [eventsA, eventsB, lakeA, lakeB, selectedStationsA, selectedStationsB, selectedOrgA, selectedOrgB, selectedParam, bucket, lakeOptions, seriesMode]);

  // Expose imperative clearAll to parent
  useImperativeHandle(ref, () => ({
    clearAll: () => {
      setLakeA('');
      setLakeB('');
      setSelectedOrgA('');
      setSelectedOrgB('');
      setSelectedStationsA([]);
      setSelectedStationsB([]);
      setSelectedParam('');
      setApplied(false);
      setEventsA([]);
      setEventsB([]);
      setSummaryA({ n: 0, mean: NaN, median: NaN });
      setSummaryB({ n: 0, mean: NaN, median: NaN });
    }
  }));

  const compareChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'bottom', labels: { color: '#fff', boxWidth: 8, font: { size: 10 } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}` } } },
    scales: { x: { ticks: { color: '#fff', maxRotation: 0, autoSkip: true, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.15)' } }, y: { ticks: { color: '#fff', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.15)' } } },
  }), []);

  // Build depth profile datasets for the selected param per lake
  const depthProfile = useMemo(() => {
    if (!selectedParam) return { datasets: [], maxDepth: 0, unit: '' };
    const parseDate = (iso) => { try { return new Date(iso); } catch { return null; } };
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const groupLabel = (d) => {
      if (!d) return null;
      if (bucket === 'year') return String(d.getFullYear());
      if (bucket === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1}`;
      return monthNames[d.getMonth()];
    };
    const depthKey = (raw) => { const n = Number(raw); if (!Number.isFinite(n)) return null; return (Math.round(n * 2) / 2).toFixed(1); };
    const colorFor = (idx) => `hsl(${(idx * 60) % 360} 80% 55%)`;

    const unitRef = { current: '' };
    // Build groups for lake A and B and tag labels accordingly
    const buildGroups = (arr, stationsSel) => {
      const groups = new Map(); // label -> Map(depthKey -> {sum,cnt})
      for (const ev of arr || []) {
        const sName = eventStationName(ev) || '';
        if (stationsSel && stationsSel.length && !stationsSel.includes(sName)) continue;
        const d = parseDate(ev.sampled_at); const gl = groupLabel(d); if (!gl) continue;
        const results = Array.isArray(ev?.results) ? ev.results : [];
        for (const r of results) {
          const p = r?.parameter; if (!p) continue;
          const match = (String(p.code) === String(selectedParam)) || (String(p.id) === String(selectedParam)) || (String(r.parameter_id) === String(selectedParam));
          if (!match || r?.value == null || r?.depth_m == null) continue;
          if (!unitRef.current) unitRef.current = p.unit || '';
          if (!groups.has(gl)) groups.set(gl, new Map());
          const depths = groups.get(gl);
          const dk = depthKey(r.depth_m); if (!dk) continue;
          const v = Number(r.value); if (!Number.isFinite(v)) continue;
          const agg = depths.get(dk) || { sum: 0, cnt: 0 };
          agg.sum += v; agg.cnt += 1; depths.set(dk, agg);
        }
      }
      return groups;
    };
    const groupsA = buildGroups(eventsA, selectedStationsA);
    const groupsB = buildGroups(eventsB, selectedStationsB);

    const datasets = [];
    let maxDepth = 0; let i = 0;
    const monthNamesOrder = monthNames;
    const orderFor = (groups) => (
      bucket === 'month' ? monthNamesOrder.filter((m) => groups.has(m))
      : bucket === 'quarter' ? ['Q1','Q2','Q3','Q4'].filter((q) => groups.has(q))
      : Array.from(groups.keys()).sort((a,b) => Number(a) - Number(b))
    );
    const pushDatasets = (groups, lakeLabel) => {
      const ordered = orderFor(groups);
      ordered.forEach((gl) => {
        const depths = groups.get(gl);
        // Build points but guard against malformed or null values (Chart.js crashes if y is null)
        let points = Array.from(depths.entries()).map(([dk, agg]) => {
          const y = Number(dk);
          const x = (agg && Number.isFinite(agg.sum) && Number.isFinite(agg.cnt) && agg.cnt > 0) ? (agg.sum / agg.cnt) : NaN;
          return { y: Number.isFinite(y) ? y : NaN, x: Number.isFinite(x) ? x : NaN };
        }).filter((pt) => Number.isFinite(pt.y) && Number.isFinite(pt.x)).sort((a,b) => a.y - b.y);
        if (!points.length) return;
        maxDepth = Math.max(maxDepth, points[points.length - 1].y || 0);
        datasets.push({ label: `${lakeLabel} – ${gl}`, data: points, parsing: false, showLine: true, borderColor: colorFor(i++), backgroundColor: 'transparent', pointRadius: 3, pointHoverRadius: 4, tension: 0.1 });
      });
    };
    const nameForLake = (lk) => lakeOptions.find((x)=>String(x.id)===String(lk))?.name || String(lk || '') || '';
    if (lakeA) pushDatasets(groupsA, nameForLake(lakeA));
    if (lakeB) pushDatasets(groupsB, nameForLake(lakeB));

    // Determine depth-data presence per lake
    const hasDepthIn = (groups) => {
      for (const depths of groups.values()) { if (depths && depths.size) return true; }
      return false;
    };
    const hasDepthA = hasDepthIn(groupsA);
    const hasDepthB = hasDepthIn(groupsB);

    return { datasets, maxDepth, unit: unitRef.current || '', hasDepthA, hasDepthB };
  }, [eventsA, eventsB, selectedParam, JSON.stringify(selectedStationsA), JSON.stringify(selectedStationsB), bucket, lakeOptions, lakeA, lakeB]);

  // Determine whether an info modal is meaningful (chart generated)
  const canShowInfo = useMemo(() => {
    if (!applied) return false;
    if (viewMode === 'time') {
      try { return Boolean(chartData && Array.isArray(chartData.datasets) && chartData.datasets.length); } catch { return false; }
    }
    try { return Boolean(depthProfile && Array.isArray(depthProfile.datasets) && depthProfile.datasets.length); } catch { return false; }
  }, [applied, viewMode, chartData, depthProfile]);

  return (
    <div className="insight-card" style={{ backgroundColor: '#0f172a' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h4 style={{ margin: 0 }}>Compare Lakes</h4>
        <button
          type="button"
          className="pill-btn liquid"
          title={canShowInfo ? 'Explain this graph' : 'Generate a chart first'}
          disabled={!canShowInfo}
          onClick={() => {
            // Parse current datasets to infer which standards (codes) are present
            const ds = chartData?.datasets || [];
            const stdMap = new Map();
            ds.forEach((d) => {
              const label = d?.label || '';
              // pattern: "<LakeName> – <Std> – Min/Max" for thresholds
              const parts = String(label).split(' – ');
              if (parts.length === 3) {
                const std = parts[1];
                const kind = parts[2];
                if (/^Min$/i.test(kind) || /^Max$/i.test(kind)) {
                  const rec = stdMap.get(std) || { code: std, min: null, max: null };
                  if (/^Min$/i.test(kind)) rec.min = 1;
                  if (/^Max$/i.test(kind)) rec.max = 1;
                  stdMap.set(std, rec);
                }
              }
            });
            const standards = Array.from(stdMap.values());
            const hasMin = standards.some(s => s.min != null);
            const hasMax = standards.some(s => s.max != null);
            const inferred = hasMin && hasMax ? 'range' : hasMin ? 'min' : hasMax ? 'max' : null;
            const pMeta = (() => {
              const sel = String(selectedParam || '');
              const opt = (paramList || []).find(p => String(p.key || p.id || p.code) === sel);
              return { code: opt?.code || sel, name: opt?.label || opt?.name || opt?.code || sel, unit: opt?.unit || '' };
            })();
            const nameForLake = (lk) => lakeOptions.find((x)=>String(x.id)===String(lk))?.name || String(lk || '') || '';
            const ctx = {
              chartType: viewMode === 'depth' ? 'depth' : 'time',
              param: pMeta,
              seriesMode,
              bucket,
              standards,
              compareMode: true,
              lakeLabels: { a: nameForLake(lakeA) || 'Lake A', b: nameForLake(lakeB) || 'Lake B' },
              summary: { n: (summaryA.n || 0) + (summaryB.n || 0), mean: NaN, median: NaN },
              inferredType: inferred,
            };
            const content = buildGraphExplanation(ctx);
            // Append per-lake summary bullets
            const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : 'N/A');
            const bullets = [];
            if (lakeA) bullets.push(`${(nameForLake(lakeA) || 'Lake A')}: Samples ${summaryA.n || 0} · Mean ${fmt(summaryA.mean)} · Median ${fmt(summaryA.median)}`);
            if (lakeB) bullets.push(`${(nameForLake(lakeB) || 'Lake B')}: Samples ${summaryB.n || 0} · Mean ${fmt(summaryB.mean)} · Median ${fmt(summaryB.median)}`);
            if (bullets.length) content.sections.push({ heading: 'Per-lake summary', bullets });
            setInfoContent(content);
            setInfoOpen(true);
          }}
          style={{ padding: '4px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <FiInfo size={14} />
        </button>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
          <select className="pill-btn" value={lakeA} onChange={(e) => { setLakeA(e.target.value); setSelectedOrgA(""); setSelectedStationsA([]); setSelectedParam(""); }} style={{ minWidth: 160, flex: '0 0 auto' }}>
            <option value="">Lake A</option>
            {lakeOptions.map((l) => (<option key={l.id} value={String(l.id)}>{l.name}</option>))}
          </select>
          <select className="pill-btn" value={selectedOrgA} onChange={(e) => { setSelectedOrgA(e.target.value); setSelectedStationsA([]); setSelectedParam("" ); }} disabled={!lakeA} style={{ minWidth: 160, flex: '0 0 auto' }}>
            <option value="">All dataset sources</option>
            {orgOptionsA.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
          </select>
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <button ref={stationBtnARef} type="button" className="pill-btn" disabled={!lakeA || !selectedOrgA} onClick={() => {
              if (!stationsOpenA) {
                const r = stationBtnARef.current?.getBoundingClientRect();
                /* position not used; kept for future */
              }
              setStationsOpenA((v) => !v);
            }} aria-label="Select locations for Lake A" title="Select locations" style={{ minWidth: 140 }}>
              {selectedStationsA.length ? `${selectedStationsA.length} selected` : 'Select locations'}
            </button>
            <Popover anchorRef={stationBtnARef} open={stationsOpenA} onClose={() => setStationsOpenA(false)} minWidth={220}>
              {stationsA.length ? (
                stationsA.map((s) => {
                  const checked = selectedStationsA.includes(s);
                  return (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', cursor: 'pointer', color: '#fff' }}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        const next = checked ? selectedStationsA.filter((x)=>x!==s) : [...selectedStationsA, s];
                        setSelectedStationsA(next); setSelectedParam("");
                      }} />
                      <span style={{ color: '#fff' }}>{s}</span>
                    </label>
                  );
                })
              ) : (<div style={{ opacity: 0.8 }}>No locations…</div>)}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                <button type="button" className="pill-btn" onClick={() => setSelectedStationsA(stationsA.slice())}>Select All</button>
                <button type="button" className="pill-btn" onClick={() => setSelectedStationsA([])}>Clear</button>
                <button type="button" className="pill-btn liquid" onClick={() => setStationsOpenA(false)}>Done</button>
              </div>
            </Popover>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch', minWidth: 0, marginTop: 6 }}>
          <select className="pill-btn" value={lakeB} onChange={(e) => { setLakeB(e.target.value); setSelectedOrgB(""); setSelectedStationsB([]); setSelectedParam(""); }} style={{ minWidth: 160, flex: '0 0 auto' }}>
            <option value="">Lake B</option>
            {lakeOptions.map((l) => (<option key={l.id} value={String(l.id)}>{l.name}</option>))}
          </select>
          <select className="pill-btn" value={selectedOrgB} onChange={(e) => { setSelectedOrgB(e.target.value); setSelectedStationsB([]); setSelectedParam(""); }} disabled={!lakeB} style={{ minWidth: 160, flex: '0 0 auto' }}>
            <option value="">All dataset sources</option>
            {orgOptionsB.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
          </select>
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <button ref={stationBtnBRef} type="button" className="pill-btn" disabled={!lakeB || !selectedOrgB} onClick={() => {
              if (!stationsOpenB) {
                const r = stationBtnBRef.current?.getBoundingClientRect();
                /* position not used; kept for future */
              }
              setStationsOpenB((v) => !v);
            }} aria-label="Select locations for Lake B" title="Select locations" style={{ minWidth: 140 }}>
              {selectedStationsB.length ? `${selectedStationsB.length} selected` : 'Select locations'}
            </button>
            <Popover anchorRef={stationBtnBRef} open={stationsOpenB} onClose={() => setStationsOpenB(false)} minWidth={220}>
              {stationsB.length ? (
                stationsB.map((s) => {
                  const checked = selectedStationsB.includes(s);
                  return (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', cursor: 'pointer', color: '#fff' }}>
                      <input type="checkbox" checked={checked} onChange={() => { const next = checked ? selectedStationsB.filter((x)=>x!==s) : [...selectedStationsB, s]; setSelectedStationsB(next); setSelectedParam(""); }} />
                      <span style={{ color: '#fff' }}>{s}</span>
                    </label>
                  );
                })
              ) : (<div style={{ opacity: 0.8 }}>No locations…</div>)}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                <button type="button" className="pill-btn" onClick={() => setSelectedStationsB(stationsB.slice())}>Select All</button>
                <button type="button" className="pill-btn" onClick={() => setSelectedStationsB([])}>Clear</button>
                <button type="button" className="pill-btn liquid" onClick={() => setStationsOpenB(false)}>Done</button>
              </div>
            </Popover>
          </div>

          <select className="pill-btn" value={selectedParam} onChange={(e) => { setSelectedParam(e.target.value); onParamChange?.(e.target.value); }} disabled={!paramList?.length || !canChooseParam} style={{ minWidth: 160, flex: '0 0 auto' }}>
            <option value="">Select parameter</option>
            {paramList.map((p) => (<option key={p.key || p.id || p.code} value={p.key || p.id || p.code}>{p.label || p.name || p.code}</option>))}
          </select>
          <div style={{ marginLeft: 'auto', flex: '0 0 auto' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ display:'inline-flex', gap:6 }} role="tablist" aria-label="Series mode">
                <button type="button" aria-pressed={seriesMode==='avg'} title="Show aggregated average series" className={`pill-btn ${seriesMode==='avg' ? 'active liquid' : ''}`} onClick={() => setSeriesMode('avg')} style={{ padding:'6px 8px' }}>Average</button>
                <button type="button" aria-pressed={seriesMode==='per-station'} title="Show one line per selected station" className={`pill-btn ${seriesMode==='per-station' ? 'active liquid' : ''}`} onClick={() => setSeriesMode('per-station')} style={{ padding:'6px 8px' }}>Per-station</button>
              </div>
              <button type="button" className="pill-btn liquid" onClick={handleApply} style={{ minWidth: 96 }}>Apply</button>
            </div>
          </div>
        </div>
      </div>
      {/* Summary stats for each lake */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ opacity: 0.9 }}>
          <strong>{lakeOptions.find((x)=>String(x.id)===String(lakeA))?.name || (lakeA ? String(lakeA) : 'Lake A')}</strong>
          <div>Samples: {summaryA.n || 0}</div>
          <div>Mean: {Number.isFinite(summaryA.mean) ? summaryA.mean.toFixed(2) : 'N/A'}</div>
          <div>Median: {Number.isFinite(summaryA.median) ? summaryA.median.toFixed(2) : 'N/A'}</div>
        </div>
        <div style={{ opacity: 0.9 }}>
          <strong>{lakeOptions.find((x)=>String(x.id)===String(lakeB))?.name || (lakeB ? String(lakeB) : 'Lake B')}</strong>
          <div>Samples: {summaryB.n || 0}</div>
          <div>Mean: {Number.isFinite(summaryB.mean) ? summaryB.mean.toFixed(2) : 'N/A'}</div>
          <div>Median: {Number.isFinite(summaryB.median) ? summaryB.median.toFixed(2) : 'N/A'}</div>
        </div>
      </div>

  <div className="wq-chart" style={{ height: 300, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', padding: 8 }}>
        {applied ? (
          viewMode === 'depth' ? (
            depthProfile && depthProfile.hasDepthA && depthProfile.hasDepthB && depthProfile.datasets && depthProfile.datasets.length ? (
              (() => {
                // Clone datasets and append threshold lines using unified/per-lake standard logic
                const depthDatasets = (depthProfile.datasets || []).slice();
                const maxDepth = depthProfile.maxDepth || 0;
                // Build per-lake standards map by scanning results (so we can unify identical standards across lakes)
                const thByLakeAndStandard = new Map(); // lakeKey -> Map(stdKey -> { stdLabel, min, max })
                const ensureStdEntry = (lkKey, stdKey, stdLabel) => {
                  if (!thByLakeAndStandard.has(lkKey)) thByLakeAndStandard.set(lkKey, new Map());
                  const inner = thByLakeAndStandard.get(lkKey);
                  if (!inner.has(stdKey)) inner.set(stdKey, { stdLabel: stdLabel || `Standard ${stdKey}`, min: null, max: null });
                  return inner.get(stdKey);
                };
                try {
                  // scan lake A
                  for (const ev of eventsA || []) {
                    const oidEv = ev.organization_id ?? ev.organization?.id ?? null;
                    if (selectedOrgA && oidEv && String(oidEv) !== String(selectedOrgA)) continue;
                    const sName = eventStationName(ev) || '';
                    if (selectedStationsA && selectedStationsA.length && !selectedStationsA.includes(sName)) continue;
                    const results = Array.isArray(ev?.results) ? ev.results : [];
                    for (const r of results) {
                      const p = r?.parameter; if (!p) continue;
                      const match = (String(p.code) === String(selectedParam)) || (String(p.id) === String(selectedParam)) || (String(r.parameter_id) === String(selectedParam));
                      if (!match) continue;
                      const stdId = r?.threshold?.standard_id ?? ev?.applied_standard_id ?? null;
                      const stdKey = r?.threshold?.standard?.code || r?.threshold?.standard?.name || (stdId != null ? String(stdId) : null);
                      const stdLabel = stdKey;
                      if (stdKey != null && (r?.threshold?.min_value != null || r?.threshold?.max_value != null)) {
                        const entry = ensureStdEntry(String(lakeA), String(stdKey), stdLabel);
                        if (r?.threshold?.min_value != null) entry.min = Number(r.threshold.min_value);
                        if (r?.threshold?.max_value != null) entry.max = Number(r.threshold.max_value);
                      }
                    }
                  }
                  // scan lake B
                  for (const ev of eventsB || []) {
                    const oidEv = ev.organization_id ?? ev.organization?.id ?? null;
                    if (selectedOrgB && oidEv && String(oidEv) !== String(selectedOrgB)) continue;
                    const sName = eventStationName(ev) || '';
                    if (selectedStationsB && selectedStationsB.length && !selectedStationsB.includes(sName)) continue;
                    const results = Array.isArray(ev?.results) ? ev.results : [];
                    for (const r of results) {
                      const p = r?.parameter; if (!p) continue;
                      const match = (String(p.code) === String(selectedParam)) || (String(p.id) === String(selectedParam)) || (String(r.parameter_id) === String(selectedParam));
                      if (!match) continue;
                      const stdId = r?.threshold?.standard_id ?? ev?.applied_standard_id ?? null;
                      const stdKey = r?.threshold?.standard?.code || r?.threshold?.standard?.name || (stdId != null ? String(stdId) : null);
                      const stdLabel = stdKey;
                      if (stdKey != null && (r?.threshold?.min_value != null || r?.threshold?.max_value != null)) {
                        const entry = ensureStdEntry(String(lakeB), String(stdKey), stdLabel);
                        if (r?.threshold?.min_value != null) entry.min = Number(r.threshold.min_value);
                        if (r?.threshold?.max_value != null) entry.max = Number(r.threshold.max_value);
                      }
                    }
                  }
                } catch (e) { /* ignore */ }

                // Combine standards across lakes but only when min/max values match.
                // Key by stdKey::min::max so different threshold values remain distinct.
                const combinedStandards = new Map(); // uniqueKey -> { stdLabel, min, max, lakes:Set }
                [lakeA, lakeB].filter(Boolean).forEach((lk) => {
                  const lkKey = String(lk);
                  const inner = thByLakeAndStandard.get(lkKey);
                  if (!inner) return;
                  inner.forEach((entry, stdKey) => {
                    const minVal = entry.min != null ? Number(entry.min) : null;
                    const maxVal = entry.max != null ? Number(entry.max) : null;
                    const uniqueKey = `${stdKey}::${minVal ?? 'null'}::${maxVal ?? 'null'}`;
                    if (!combinedStandards.has(uniqueKey)) combinedStandards.set(uniqueKey, { stdLabel: entry.stdLabel, min: minVal, max: maxVal, lakes: new Set([lkKey]) });
                    else combinedStandards.get(uniqueKey).lakes.add(lkKey);
                  });
                });

                const minColorUnified = '#16a34a';
                const maxColorUnified = '#ef4444';
                const lakeMinColors = ['#16a34a', '#f59e0b'];
                const lakeMaxColors = ['#ef4444', '#f97316'];

                combinedStandards.forEach((entry) => {
                  if (entry.lakes.size > 1) {
                    // Unified line; include each lake's class in the label
                    const lakesMeta = Array.from(entry.lakes).map((lkKey) => {
                      const nm = nameForLake(lkKey);
                      const cls = classForLake(lkKey);
                      return `${nm}${cls ? `: Class ${cls}` : ''}`;
                    }).join(', ');
                    if (entry.min != null) {
                      depthDatasets.push({ label: `${entry.stdLabel} – Min (${lakesMeta})`, data: [{ x: entry.min, y: 0 }, { x: entry.min, y: Math.max(1, maxDepth) }], borderColor: minColorUnified, backgroundColor: `${minColorUnified}33`, borderDash: [4,4], pointRadius: 0, tension: 0, spanGaps: true, showLine: true, parsing: false });
                    }
                    if (entry.max != null) {
                      depthDatasets.push({ label: `${entry.stdLabel} – Max (${lakesMeta})`, data: [{ x: entry.max, y: 0 }, { x: entry.max, y: Math.max(1, maxDepth) }], borderColor: maxColorUnified, backgroundColor: `${maxColorUnified}33`, borderDash: [4,4], pointRadius: 0, tension: 0, spanGaps: true, showLine: true, parsing: false });
                    }
                  } else {
                    // Only present in one lake; render per-lake threshold line for that lake
                    const onlyLakeKey = Array.from(entry.lakes)[0];
                    const li = [lakeA, lakeB].findIndex((lk) => String(lk) === onlyLakeKey);
                    const minColor = lakeMinColors[li % lakeMinColors.length];
                    const maxColor = lakeMaxColors[li % lakeMaxColors.length];
                    const lakeLabel = lakeOptions.find((x)=>String(x.id)===onlyLakeKey)?.name || onlyLakeKey;
                    const cls = classForLake(onlyLakeKey);
                    if (entry.min != null) {
                      depthDatasets.push({ label: `${lakeLabel}${cls ? ` – Class ${cls}` : ''} – ${entry.stdLabel} – Min`, data: [{ x: entry.min, y: 0 }, { x: entry.min, y: Math.max(1, maxDepth) }], borderColor: minColor, backgroundColor: `${minColor}33`, borderDash: [4,4], pointRadius: 0, tension: 0, spanGaps: true, showLine: true, parsing: false });
                    }
                    if (entry.max != null) {
                      depthDatasets.push({ label: `${lakeLabel}${cls ? ` – Class ${cls}` : ''} – ${entry.stdLabel} – Max`, data: [{ x: entry.max, y: 0 }, { x: entry.max, y: Math.max(1, maxDepth) }], borderColor: maxColor, backgroundColor: `${maxColor}33`, borderDash: [4,4], pointRadius: 0, tension: 0, spanGaps: true, showLine: true, parsing: false });
                    }
                  }
                });

                // Normalize datasets: ensure each dataset.data is an array of {x:number,y:number}
                const normalizePoint = (pt) => {
                  if (pt == null) return null;
                  if (typeof pt === 'number') {
                    // fallback: interpret number as x value at depth 0
                    const x = Number(pt);
                    return Number.isFinite(x) ? { x, y: 0 } : null;
                  }
                  if (typeof pt === 'object') {
                    const x = Number(pt.x ?? pt.value ?? NaN);
                    const y = Number(pt.y ?? pt.depth ?? NaN);
                    return (Number.isFinite(x) && Number.isFinite(y)) ? { x, y } : null;
                  }
                  return null;
                };
                const safeDatasets = depthDatasets.map((ds) => {
                  const raw = Array.isArray(ds.data) ? ds.data : [];
                  const mapped = raw.map(normalizePoint).filter((p) => p !== null);
                  return { ...ds, data: mapped, parsing: false };
                }).filter((ds) => Array.isArray(ds.data) && ds.data.length);
                const depthData = { datasets: safeDatasets };
                return (
                  <Line
                    key={`depth-${selectedParam}-${lakeA}-${lakeB}-${seriesMode}`}
                    ref={chartRef}
                    data={depthData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: true, position: 'bottom', labels: { color: '#fff', boxWidth: 8, font: { size: 10 } } },
                        tooltip: { callbacks: { label: (ctx) => {
                          const v = ctx.parsed?.x ?? ctx.raw?.x; const d = ctx.parsed?.y ?? ctx.raw?.y;
                          return `${ctx.dataset.label}: ${Number(v).toFixed(2)}${depthProfile.unit ? ` ${depthProfile.unit}` : ''} at ${d} m`;
                        } } },
                      },
                      scales: {
                        x: { type: 'linear', title: { display: true, text: `Value${depthProfile.unit ? ` (${depthProfile.unit})` : ''}`, color: '#fff' }, ticks: { color: '#fff', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.15)' } },
                        y: { type: 'linear', reverse: true, title: { display: true, text: 'Depth (m)', color: '#fff' }, min: 0, suggestedMax: Math.max(5, depthProfile.maxDepth || 0), ticks: { color: '#fff', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.15)' } },
                      },
                    }}
                  />
                );
              })()
            ) : (
              (() => {
                const labelA = nameForLake(lakeA) || 'Lake A';
                const labelB = nameForLake(lakeB) || 'Lake B';
                const hasA = depthProfile?.hasDepthA; const hasB = depthProfile?.hasDepthB;
                let msg = 'Depth profile requires multiple depths; only surface (0 m) measurements were found for this selection.';
                if (hasA === false && hasB === false) {
                  msg = `Only surface (0 m) measurements are available for ${labelA} and ${labelB} for this parameter. A depth profile requires multiple depths.`;
                } else if (hasA === false) {
                  msg = `${labelA} only has surface (0 m) measurements for this parameter. A depth profile requires multiple depths.`;
                } else if (hasB === false) {
                  msg = `${labelB} only has surface (0 m) measurements for this parameter. A depth profile requires multiple depths.`;
                }
                return (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ opacity: 0.9 }}>{msg}</span>
                  </div>
                );
              })()
            )
          ) : (
            chartData && chartData.datasets && chartData.datasets.length ? (
              <Line key={`time-${selectedParam}-${lakeA}-${lakeB}-${seriesMode}`} ref={chartRef} data={chartData} options={compareChartOptions} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ opacity: 0.9 }}>{loading ? 'Loading…' : 'Fill all fields and click Apply to generate the chart.'}</span>
              </div>
            )
          )
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ opacity: 0.9 }}>{loading ? 'Loading…' : 'Fill all fields and click Apply to generate the chart.'}</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <button
          type="button"
          className="pill-btn"
          disabled={!applied}
          onClick={() => setViewMode((m) => (m === 'time' ? 'depth' : 'time'))}
          title={viewMode === 'time' ? 'Show depth profile' : 'Show time series'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {viewMode === 'time' ? <FiActivity size={14} /> : <FiBarChart2 size={14} />}
          {viewMode === 'time' ? 'Depth profile' : 'Time series'}
        </button>
      </div>
      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} title={infoContent.title} sections={infoContent.sections} />
    </div>
  );
}

export default React.forwardRef(CompareLake);
