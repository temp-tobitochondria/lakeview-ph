import React, { useEffect, useMemo, useState, useRef } from "react";
import { Line, Scatter } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import { FiActivity, FiBarChart2 } from "react-icons/fi";
import InfoModal from "../common/InfoModal";
import { buildGraphExplanation } from "../utils/graphExplain";
import { eventStationName, parseIsoDate, depthBandKeyInt, depthKeyHalfM } from "./utils/dataUtils";
import { bucketKey as makeBucketKey, bucketSortKey as sortBucketKey, monthNames, groupLabel as makeGroupLabel } from "./utils/chartUtils";
import { lakeName, lakeClass, baseLineChartOptions, parseThresholdStandardsFromDatasets, normalizeDepthDatasets } from "./utils/shared";
import useSampleEvents from "./hooks/useSampleEvents";
import useStationsCache from "./hooks/useStationsCache";
import useSummaryStats from "./hooks/useSummaryStats";
import useTimeSeriesData from "./hooks/useTimeSeriesData";
import useDepthProfileData from "./hooks/useDepthProfileData";
import useSpatialTrendData from "./hooks/useSpatialTrendData";
import useCorrelationData from "./hooks/useCorrelationData";
import GraphInfoButton from "./ui/GraphInfoButton";
import StationPicker from "./ui/StationPicker";
import { SeriesModeToggle } from "./ui/Toggles";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function SingleLake({
  lakeOptions,
  selectedLake,
  onLakeChange,
  orgOptions,
  selectedOrg,
  onOrgChange,
  stations,
  selectedStations,
  onStationsChange,
  paramOptions,
  selectedParam,
  onParamChange,
  thresholds,
  currentRecords,
  selectedClass,
  bucket,
  chartOptions,
  chartRef,
  timeRange = 'all',
  dateFrom = '',
  dateTo = '',
}) {
  const [stationsOpen, setStationsOpen] = useState(false);
  const stationBtnRef = useRef(null);
  const [applied, setApplied] = useState(false);
  // 'time' | 'depth' | 'spatial' | 'correlation'
  const [chartType, setChartType] = useState('time');
  const [seriesMode, setSeriesMode] = useState('avg'); // 'avg' | 'per-station'
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoContent, setInfoContent] = useState({ title: '', sections: [] });
  // Spatial Trend options
  const [spatialSnapshot, setSpatialSnapshot] = useState('latest'); // 'latest' | 'mean'
  const [spatialDepth, setSpatialDepth] = useState('surface'); // 'surface' | 'avg'
  // Correlation options
  const [paramX, setParamX] = useState('');
  const [paramY, setParamY] = useState('');
  const { events, loading } = useSampleEvents(selectedLake, selectedOrg, timeRange, dateFrom, dateTo);
  // All datasets are expected to have station identifiers
  const hasStationIds = true;
  const { orgOptions: orgOptionsLocal, stationsByOrg, allStations } = useStationsCache(selectedLake);
  const stationsList = useMemo(() => (!selectedOrg ? (allStations || []) : (stationsByOrg?.[String(selectedOrg)] || [])), [selectedOrg, allStations, stationsByOrg]);
  useEffect(() => {
    setApplied(false);
  }, [selectedLake, selectedOrg, selectedParam, JSON.stringify(selectedStations), timeRange, dateFrom, dateTo, bucket, chartType, paramX, paramY, spatialSnapshot, spatialDepth]);

  // per-station mode available when stations are present

  // All chart types available as stations are required
  const summaryStats = useSummaryStats({ applied, events, selectedStations, selectedParam });
  const nameForSelectedLake = useMemo(() => lakeName(lakeOptions, selectedLake) || String(selectedLake || '') || '', [lakeOptions, selectedLake]);
  const classForSelectedLake = useMemo(() => lakeClass(lakeOptions, selectedLake) || selectedClass || '', [lakeOptions, selectedLake, selectedClass]);
  const chartData = useTimeSeriesData({ events, selectedParam, selectedStations, bucket, timeRange, dateFrom, dateTo, seriesMode, classForSelectedLake });

  const depthProfile = useDepthProfileData({ events, selectedParam, selectedStations, bucket });

  const spatialTrend = useSpatialTrendData({ events, selectedStations, selectedParam, snapshot: spatialSnapshot, depthMode: spatialDepth, paramOptions });
  const correlation = useCorrelationData({ events, station: (selectedStations && selectedStations.length === 1) ? selectedStations[0] : '', paramX, paramY, depthMode: 'surface', paramOptions });

  const canShowInfo = useMemo(() => {
    if (!applied) return false;
    try {
      if (chartType === 'time') return Boolean(chartData?.datasets?.length);
      if (chartType === 'depth') return Boolean(depthProfile?.datasets?.length);
      if (chartType === 'spatial') return Boolean(spatialTrend?.datasets?.length);
      if (chartType === 'correlation') return Boolean(correlation?.datasets?.length);
      return false;
    } catch { return false; }
  }, [applied, chartType, chartData, depthProfile, spatialTrend, correlation]);

  const canChooseParam = useMemo(() => {
    if (!selectedLake || !selectedOrg) return false;
    return Array.isArray(selectedStations) && selectedStations.length > 0;
  }, [selectedLake, selectedOrg, selectedStations]);

  const computeMissingFields = () => {
    const missing = [];
    if (!selectedLake) { missing.push('Select a lake'); return missing; }
    if (!selectedOrg) missing.push('choose a dataset source');
  if (!selectedStations || selectedStations.length === 0) missing.push('choose at least one location');
    if (chartType === 'correlation') {
      if (selectedStations && selectedStations.length !== 1) missing.push('choose exactly one location for correlation');
      if (!paramX) missing.push('select parameter X');
      if (!paramY) missing.push('select parameter Y');
      if (paramX && paramY && String(paramX) === String(paramY)) missing.push('choose different parameters for X and Y');
    } else {
      if (!selectedParam) missing.push('select a parameter');
    }
    return missing;
  };

  const handleApply = async () => {
    const missing = computeMissingFields();
    if (missing.length) {
      const sentence = `Please ${missing.join(', ')}.`;
      try {
        const Swal = (await import('sweetalert2')).default;
        Swal.fire({
          icon: 'warning',
          title: 'Missing fields',
          html: `<div style="text-align:left; white-space:normal; word-break:break-word; font-size:13px">${sentence}</div>`,
          width: 560,
          showCloseButton: true,
        });
      } catch (e) {
        window.alert(sentence);
      }
      return;
    }
    setApplied(true);
  };

  const singleChartOptions = useMemo(() => baseLineChartOptions(), []);

  const isComplete = useMemo(() => {
    if (!selectedLake) return false;
    if (chartType === 'correlation') return selectedStations && selectedStations.length === 1 && paramX && paramY && String(paramX) !== String(paramY);
    return Boolean(selectedStations && selectedStations.length > 0 && selectedParam);
  }, [selectedLake, JSON.stringify(selectedStations), chartType, paramX, paramY, selectedParam]);

  return (
    <div className="insight-card" style={{ backgroundColor: '#0f172a' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h4 style={{ margin: 0 }}>Single Lake</h4>
        <GraphInfoButton
          disabled={!canShowInfo}
          onClick={() => {
            if (!canShowInfo) return;
            // Extract standards from current datasets (threshold lines are labeled "<std> – Min/Max")
            const standards = (() => {
              const ds = chartData?.datasets || [];
              const map = new Map();
              ds.forEach((d) => {
                const label = d?.label || '';
                const parts = String(label).split(' – ');
                if (parts.length === 2) {
                  const std = parts[0];
                  const kind = parts[1];
                  if (/^Min$/i.test(kind) || /^Max$/i.test(kind)) {
                    const rec = map.get(std) || { code: std, min: null, max: null };
                    if (/^Min$/i.test(kind)) rec.min = 1;
                    if (/^Max$/i.test(kind)) rec.max = 1;
                    map.set(std, rec);
                  }
                }
              });
              return Array.from(map.values());
            })();
            const hasMin = standards.some(s => s.min != null);
            const hasMax = standards.some(s => s.max != null);
            const inferred = hasMin && hasMax ? 'range' : hasMin ? 'min' : hasMax ? 'max' : null;
            const pMeta = (() => {
              const sel = String(selectedParam || '');
              const opt = (paramOptions || []).find(p => String(p.key || p.id || p.code) === sel);
              return { code: opt?.code || sel, name: opt?.label || opt?.name || opt?.code || sel, unit: opt?.unit || '' };
            })();
            const ctx = {
              chartType,
              param: pMeta,
              seriesMode,
              bucket,
              standards,
              compareMode: false,
              summary: summaryStats,
              inferredType: inferred,
            };
            const content = buildGraphExplanation(ctx);
            setInfoContent(content);
            setInfoOpen(true);
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Sidebar */}
        <aside style={{ width: 320, flex: '0 0 auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Lake</div>
              <select className="pill-btn" value={selectedLake} onChange={(e) => { onLakeChange(e.target.value); setApplied(false); }} style={{ width: '100%' }}>
                <option value="">Select lake</option>
                {lakeOptions.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Dataset source</div>
              <select className="pill-btn" value={selectedOrg} onChange={(e) => { onOrgChange(e.target.value); onStationsChange([]); setApplied(false); }} disabled={!selectedLake} style={{ width: '100%' }}>
                <option value="">All dataset sources</option>
                {orgOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            {true ? (
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Locations</div>
                <div style={{ position: 'relative' }}>
                  <button ref={stationBtnRef} type="button" className="pill-btn" disabled={!selectedLake || !selectedOrg || !stationsList?.length} title={!selectedOrg ? 'Choose a dataset source first' : (!stationsList?.length ? 'No stations available' : undefined)} onClick={() => setStationsOpen((v) => !v)} style={{ width: '100%' }}>
                    {selectedStations.length ? `${selectedStations.length} selected` : 'Select locations'}
                  </button>
                  <StationPicker
                    anchorRef={stationBtnRef}
                    open={stationsOpen}
                    onClose={() => setStationsOpen(false)}
                    stations={stationsList}
                    value={selectedStations}
                    onChange={(next) => { onStationsChange(next); onParamChange(""); setApplied(false); }}
                  />
                </div>
              </div>
            ) : null}

            {/* Chart Type */}
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Chart Type</div>
              <select className="pill-btn" value={chartType} onChange={(e) => {
                const next = e.target.value;
                setChartType(next);
                if (next === 'correlation') {
                  // Seed X/Y if empty to help users see something quickly
                  if (!paramX && selectedParam) setParamX(selectedParam);
                  if (!paramY) {
                    const alt = (paramOptions || []).find(p => String(p.key || p.id || p.code) !== String(paramX || selectedParam));
                    if (alt) setParamY(alt.key || alt.id || alt.code);
                  }
                }
                setApplied(false);
              }} style={{ width: '100%' }}>
                <option value="time">Time series</option>
                <option value="depth">Depth profile</option>
                <option value="spatial">Spatial trend</option>
                <option value="correlation">Correlation</option>
              </select>
              
            </div>

            {(chartType === 'time' || chartType === 'depth') && (
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Series Mode</div>
                <SeriesModeToggle mode={seriesMode} onChange={setSeriesMode} />
              </div>
            )}
            {chartType === 'spatial' && (
              <>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Snapshot</div>
                  <select className="pill-btn" value={spatialSnapshot} onChange={(e) => { setSpatialSnapshot(e.target.value); setApplied(false); }} style={{ width: '100%' }}>
                    <option value="latest">Latest per station</option>
                    <option value="mean">Mean within range</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Depth</div>
                  <select className="pill-btn" value={spatialDepth} onChange={(e) => { setSpatialDepth(e.target.value); setApplied(false); }} style={{ width: '100%' }}>
                    <option value="surface">Surface only (0 m)</option>
                    <option value="avg">All depths (avg)</option>
                  </select>
                </div>
              </>
            )}
            {chartType === 'correlation' && (
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Station requirement: select exactly one location.
              </div>
            )}

            {/* Parameters */}
            {chartType !== 'correlation' ? (
              <div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Parameter</div>
                <select className="pill-btn" value={selectedParam} onChange={(e) => { onParamChange(e.target.value); setApplied(false); }} disabled={!canChooseParam} style={{ width: '100%' }}>
                  <option value="">Select parameter</option>
                  {paramOptions.map((p) => (
                    <option key={p.key || p.id || p.code} value={p.key || p.id || p.code}>{p.label || p.name || p.code}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Parameter X</div>
                  <select className="pill-btn" value={paramX} onChange={(e) => { setParamX(e.target.value); setApplied(false); }} disabled={!canChooseParam} style={{ width: '100%' }}>
                    <option value="">Select parameter X</option>
                    {paramOptions.map((p) => (
                      <option key={p.key || p.id || p.code} value={p.key || p.id || p.code}>{p.label || p.name || p.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Parameter Y</div>
                  <select className="pill-btn" value={paramY} onChange={(e) => { setParamY(e.target.value); setApplied(false); }} disabled={!canChooseParam} style={{ width: '100%' }}>
                    <option value="">Select parameter Y</option>
                    {paramOptions.map((p) => (
                      <option key={p.key || p.id || p.code} value={p.key || p.id || p.code}>{p.label || p.name || p.code}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <button type="button" className="pill-btn liquid" onClick={handleApply} style={{ width: '100%' }}>Apply</button>
            </div>
          </div>
        </aside>

        {/* Main panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Summary stats removed per design: Samples / Mean / Median are no longer shown here */}
          <div className="wq-chart" style={{ height: 300, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', padding: 8 }}>
        {applied ? (
          chartType === 'depth' ? (
            depthProfile && depthProfile.datasets && depthProfile.datasets.length && depthProfile.hasMultipleDepths ? (
              (() => {
                const depthDatasets = (depthProfile.datasets || []).slice();
                const maxDepth = depthProfile.maxDepth || 0;
                let tMin = null; let tMax = null; let stdLabel = null;
                try {
                  for (const ev of events || []) {
                    const sName = eventStationName(ev) || '';
                    if (!selectedStations.includes(sName)) continue;
                    const results = Array.isArray(ev?.results) ? ev.results : [];
                    for (const r of results) {
                      const p = r?.parameter; if (!p) continue;
                      const match = (String(p.code) === String(selectedParam)) || (String(p.id) === String(selectedParam)) || (String(r.parameter_id) === String(selectedParam));
                      if (!match) continue;
                      const sk = r?.threshold?.standard?.code || r?.threshold?.standard?.name || null;
                      if (!stdLabel && sk) stdLabel = sk;
                      if (r?.threshold?.min_value != null && tMin == null) tMin = Number(r.threshold.min_value);
                      if (r?.threshold?.max_value != null && tMax == null) tMax = Number(r.threshold.max_value);
                      if (tMin != null && tMax != null) break;
                    }
                    if (tMin != null && tMax != null) break;
                  }
                } catch (e) { /* ignore */ }
                const clsLbl = classForSelectedLake ? ` (Class ${classForSelectedLake})` : '';
                if (Number.isFinite(tMin)) {
                  depthDatasets.push({ label: `${stdLabel || 'Standard'}${clsLbl} – Min`, data: [{ x: tMin, y: 0 }, { x: tMin, y: Math.max(1, maxDepth) }], borderColor: 'rgba(16,185,129,1)', backgroundColor: 'transparent', pointRadius: 0, borderDash: [4,4], tension: 0, spanGaps: true, showLine: true, parsing: false });
                }
                if (Number.isFinite(tMax)) {
                  depthDatasets.push({ label: `${stdLabel || 'Standard'}${clsLbl} – Max`, data: [{ x: tMax, y: 0 }, { x: tMax, y: Math.max(1, maxDepth) }], borderColor: 'rgba(239,68,68,1)', backgroundColor: 'transparent', pointRadius: 0, borderDash: [4,4], tension: 0, spanGaps: true, showLine: true, parsing: false });
                }
                const depthData = { datasets: normalizeDepthDatasets(depthDatasets) };
                return (
                  <Line
                    key={`depth-${selectedParam}-${selectedLake}-${seriesMode}`}
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
                const lakeLabel = nameForSelectedLake || 'this lake';
                let msg = 'Depth profile requires multiple depths; only surface (0 m) measurements were found for this selection.';
                if (depthProfile && depthProfile.onlySurface) {
                  msg = `Only surface (0 m) measurements are available for ${lakeLabel} for this parameter. A depth profile requires multiple depths.`;
                }
                return (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ opacity: 0.9 }}>{msg}</span>
                  </div>
                );
              })()
            )
          ) : chartType === 'time' ? (
            chartData && chartData.datasets && chartData.datasets.length ? (
              <Line key={`time-${selectedParam}-${selectedLake}-${seriesMode}`} ref={chartRef} data={chartData} options={singleChartOptions} />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ opacity: 0.9 }}>No time-series data available for this selection.</span>
              </div>
            )
          ) : chartType === 'spatial' ? (
            spatialTrend && spatialTrend.datasets && spatialTrend.datasets.length ? (
              <Line
                key={`spatial-${selectedParam}-${selectedLake}-${spatialSnapshot}-${spatialDepth}`}
                ref={chartRef}
                data={{ labels: spatialTrend.labels, datasets: spatialTrend.datasets }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: true, position: 'bottom', labels: { color: '#fff', boxWidth: 8, font: { size: 10 } } } },
                  scales: {
                    x: { type: 'category', title: { display: true, text: 'Stations (order selected)', color: '#fff' }, ticks: { color: '#fff', font: { size: 10 }, autoSkip: false }, grid: { color: 'rgba(255,255,255,0.15)' } },
                    y: { type: 'linear', title: { display: true, text: `Value${spatialTrend.unit ? ` (${spatialTrend.unit})` : ''}`, color: '#fff' }, ticks: { color: '#fff', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.15)' } },
                  },
                }}
              />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ opacity: 0.9 }}>No spatial-trend data available for this selection.</span>
              </div>
            )
          ) : chartType === 'correlation' ? (
            correlation && correlation.datasets && correlation.datasets.length ? (
              <Scatter
                key={`corr-${paramX}-${paramY}-${selectedLake}-${selectedStations?.[0] || ''}`}
                ref={chartRef}
                data={{ datasets: correlation.datasets }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: true, position: 'bottom', labels: { color: '#fff', boxWidth: 8, font: { size: 10 } } } },
                  scales: {
                    x: { type: 'linear', title: { display: true, text: `X${correlation.unitX ? ` (${correlation.unitX})` : ''}`, color: '#fff' }, ticks: { color: '#fff', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.15)' } },
                    y: { type: 'linear', title: { display: true, text: `Y${correlation.unitY ? ` (${correlation.unitY})` : ''}`, color: '#fff' }, ticks: { color: '#fff', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.15)' } },
                  },
                }}
              />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ opacity: 0.9 }}>No correlation data available. Ensure exactly one station is selected and both parameters have overlapping samples.</span>
              </div>
            )
          ) : null
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ opacity: 0.9 }}>{isComplete ? 'Click Apply to generate the chart.' : 'Fill all fields to enable Apply.'}</span>
          </div>
        )}
      </div>
      </div>
      </div>
      {/* Bottom toggle removed; chart type is now selected in the sidebar */}
      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} title={infoContent.title} sections={infoContent.sections} />
    </div>
  );
}
