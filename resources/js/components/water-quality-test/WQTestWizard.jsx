import React, { useMemo, useState } from "react";
import {
  FiMapPin, FiUser, FiThermometer, FiClipboard, FiCheckCircle,
  FiPlus, FiTrash2, FiEdit2, FiFlag
} from "react-icons/fi";
import Wizard from "../Wizard";
import AppMap from "../AppMap";
import MapViewport from "../MapViewport";
import StationModal from "../../components/modals/StationModal";
import { GeoJSON, Marker, Popup } from "react-leaflet";
import L from "leaflet";

/* --------------------- Config / Mock Data (until backend) -------------------- */
const STEP_LABELS = [
  { key: "location",   title: "Lake & Location",    icon: <FiMapPin /> },
  { key: "details",    title: "Sampling Details",   icon: <FiUser /> },
  { key: "parameters", title: "Parameters",         icon: <FiThermometer /> },
  { key: "standard",   title: "Standard & Notes",   icon: <FiClipboard /> },
  { key: "review",     title: "Review",             icon: <FiCheckCircle /> },
];

const MOCK_LAKES = [
  { id: 1, name: "Laguna de Bay", class_code: "C" },
  { id: 2, name: "Taal Lake",     class_code: "B" },
  { id: 3, name: "Lake Bunot",    class_code: "C" },
];

const MOCK_STATIONS = {
  1: [
    { id: 101, name: "LLDA Sta. Rosa", lat: 14.276, lng: 121.110, description: "" },
    { id: 102, name: "LLDA Calamba",   lat: 14.214, lng: 121.165, description: "" },
  ],
  2: [{ id: 201, name: "Pulo North", lat: 14.002, lng: 120.979, description: "" }],
  3: [{ id: 301, name: "Bunot West", lat: 14.064, lng: 121.314, description: "" }],
};

const MOCK_PARAMETERS = [
  { id: 1, code: "DO",   name: "Dissolved Oxygen",          unit: "mg/L" },
  { id: 2, code: "pH",   name: "pH",                         unit: "" },
  { id: 3, code: "BOD",  name: "Biochemical Oxygen Demand",  unit: "mg/L" },
  { id: 4, code: "Temp", name: "Temperature",                unit: "°C" },
];

const MOCK_STANDARDS = [
  { id: 1, code: "DAO2016-08", name: "DENR DAO 2016-08",            is_current: false },
  { id: 2, code: "DAO2021-19", name: "DENR DAO 2021-19 (Current)",  is_current: true  },
];

const fmtDateLocal = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const DEFAULT_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const INITIAL_DATA = {
  organization_id: null,
  organization_name: "",
  lake_id: "",
  lake_name: "",
  lake_class_code: "",
  loc_mode: "coord",
  lat: "",
  lng: "",
  station_id: "",
  station_name: "",
  station_desc: "",
  geom_point: null,
  sampled_at: fmtDateLocal(),
  method: "",
  sampler_name: "",
  weather: "",
  results: [],
  applied_standard_id: "",
  applied_standard_code: "",
  notes: "",
  status: "draft",
};

/* ------------------------------ Small UI helpers ----------------------------- */
const Tag = ({ children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 8px", borderRadius: 999, fontSize: 12,
    background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe",
  }}>{children}</span>
);
const FormRow = ({ children, style }) => <div className="org-form" style={style}>{children}</div>;
const FG = ({ label, children, style }) => (
  <div className="form-group" style={style}>
    {label ? <label>{label}</label> : null}
    {children}
  </div>
);

/* -------------------------------- Component --------------------------------- */
export default function WQTestWizard({
  lakes = MOCK_LAKES,
  lakeGeoms = {},
  stationsByLake: stationsByLakeProp = MOCK_STATIONS,
  parameters = MOCK_PARAMETERS,
  standards = MOCK_STANDARDS,
  organization = null,
  currentUserRole = "org-admin",   // "org-admin" | "contributor" | "system-admin"
  onSubmit,
}) {
  const [stationsByLake, setStationsByLake] = useState(stationsByLakeProp);
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [stationEdit, setStationEdit] = useState(null);

  const lakeOptions      = Array.isArray(lakes)      && lakes.length      ? lakes      : MOCK_LAKES;
  const parameterOptions = Array.isArray(parameters) && parameters.length ? parameters : MOCK_PARAMETERS;
  const standardOptions  = Array.isArray(standards)  && standards.length  ? standards  : MOCK_STANDARDS;

  const canPublish = currentUserRole === "org-admin" || currentUserRole === "system-admin";
  const stationOptions = (data) => stationsByLake?.[data.lake_id] || [];

  const mapBounds = (data) => {
    if (data?.geom_point) {
      const { lat, lng } = data.geom_point;
      const pad = 0.02;
      return [[lat - pad, lng - pad], [lat + pad, lng + pad]];
    }
    if (data?.lake_id && lakeGeoms?.[data.lake_id]) {
      try {
        const layer = L.geoJSON(lakeGeoms[data.lake_id]);
        return layer.getBounds();
      } catch {}
    }
    return [[13.5, 120.5], [15.5, 122.2]];
  };

  const initialData = {
    ...INITIAL_DATA,
    organization_id: organization?.id ?? null,
    organization_name: organization?.name ?? "",
  };

  /* ----------------------------- handlers (ctx) ------------------------------ */
  const pickLake = (data, setData, lakeId) => {
    const id = lakeId || "";
    const lake = lakeOptions.find((l) => String(l.id) === String(id));
    setData({
      ...data,
      lake_id: id,
      lake_name: lake?.name || "",
      lake_class_code: lake?.class_code || "",
      station_id: "",
      station_name: "",
      station_desc: "",
    });
  };
  const setLocMode = (data, setData, mode) => setData({ ...data, loc_mode: mode });
  const setCoords = (data, setData, lat, lng) => {
    const nlat = Number(lat), nlng = Number(lng);
    if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) return setData({ ...data, lat, lng });
    setData({ ...data, lat, lng, geom_point: { lat: nlat, lng: nlng } });
  };
  const pickStation = (data, setData, stationId) => {
    const st = stationOptions(data).find((s) => String(s.id) === String(stationId));
    if (!st) return setData({ ...data, station_id: "", station_name: "", station_desc: "" });
    setData({
      ...data,
      station_id: stationId,
      station_name: st.name,
      station_desc: st.description || "",
      lat: st.lat, lng: st.lng,
      geom_point: { lat: st.lat, lng: st.lng },
    });
  };
  const handleMapClick = (data, setData, e) => {
    const { lat, lng } = e?.latlng || {};
    if (!lat || !lng) return;
    setCoords(data, setData, Number(lat.toFixed(6)), Number(lng.toFixed(6)));
  };

  // Parameter rows
  const addRow = (data, setData) =>
    setData({
      ...data,
      results: [
        ...(data.results || []),
        {
          tempId: crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          parameter_id: "",
          parameter_code: "",
          value: "",
          unit: "",
          depth_m: "",
          remarks: "",
        },
      ],
    });
  const rmRow = (data, setData, tempId) =>
    setData({ ...data, results: (data.results || []).filter((r) => r.tempId !== tempId) });
  const patchRow = (data, setData, tempId, patch) => {
    const next = (data.results || []).map((r) => {
      if (r.tempId !== tempId) return r;
      const nr = { ...r, ...patch };
      if (patch.parameter_id !== undefined) {
        const p = parameterOptions.find((pp) => String(pp.id) === String(patch.parameter_id));
        nr.parameter_code = p?.code || "";
        if (!nr.unit) nr.unit = p?.unit || "";
      }
      return nr;
    });
    setData({ ...data, results: next });
  };

  // Station CRUD using modal
  const createStation = (data, setData, station) => {
    const newId = Date.now();
    const list = stationsByLake[data.lake_id] || [];
    const newStation = { id: newId, ...station };
    setStationsByLake({ ...stationsByLake, [data.lake_id]: [...list, newStation] });
    setData({
      ...data,
      station_id: newId,
      station_name: station.name,
      station_desc: station.description || "",
      lat: station.lat,
      lng: station.lng,
      geom_point: { lat: station.lat, lng: station.lng },
    });
  };
  const updateStation = (data, setData, station) => {
    const list = stationsByLake[data.lake_id] || [];
    const updated = list.map((s) => (s.id === station.id ? { ...s, ...station } : s));
    setStationsByLake({ ...stationsByLake, [data.lake_id]: updated });
    if (String(data.station_id) === String(station.id)) {
      setData({
        ...data,
        station_name: station.name,
        station_desc: station.description || "",
        lat: station.lat,
        lng: station.lng,
        geom_point: { lat: station.lat, lng: station.lng },
      });
    }
  };
  const deleteStation = (data, setData, stationId) => {
    const list = stationsByLake[data.lake_id] || [];
    const updated = list.filter((s) => s.id !== stationId);
    setStationsByLake({ ...stationsByLake, [data.lake_id]: updated });
    if (String(data.station_id) === String(stationId)) {
      setData({ ...data, station_id: "", station_name: "", station_desc: "" });
    }
  };

  const submit = (data) => {
    const payload = {
      ...data,
      organization_id: data.organization_id ?? null,
      lake_id: data.lake_id ? Number(data.lake_id) : null,
      station_id: data.station_id ? Number(data.station_id) : null,
      lat: data.lat === "" ? null : Number(data.lat),
      lng: data.lng === "" ? null : Number(data.lng),
      results: (data.results || []).map((r) => ({
        ...r,
        parameter_id: r.parameter_id ? Number(r.parameter_id) : null,
        value: r.value === "" ? null : Number(r.value),
        depth_m: r.depth_m === "" ? null : Number(r.depth_m),
      })),
      status: canPublish ? (data.status || "draft") : "draft",
      // year/quarter/month/day are GENERATED on the DB from sampled_at; no need to send.
    };
    onSubmit?.(payload);
  };

  /* --------------------------------- Steps ---------------------------------- */
  const steps = [
    {
      key: STEP_LABELS[0].key,
      title: STEP_LABELS[0].title,
      canNext: (d) => {
        if (!d.lake_id) return false;
        if (d.loc_mode === "coord") return d.lat !== "" && d.lng !== "";
        if (d.station_id) return true;
        return false;
      },
      render: ({ data, setData }) => (
        <div className="wizard-pane">
          {organization && (
            <div className="info-row" style={{ marginBottom: 12 }}>
              <Tag>
                <FiFlag /> Org: {organization.name}
              </Tag>
            </div>
          )}

          <FormRow>
            <FG label="Lake *" style={{ minWidth: 260 }}>
              <select
                value={data.lake_id}
                onChange={(e) => pickLake(data, setData, e.target.value)}
              >
                <option value="">Select a lake…</option>
                {lakeOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </FG>
          </FormRow>

          <div className="org-form" style={{ marginTop: 8 }}>
            <div className="form-group" style={{ minWidth: 220 }}>
              <label>Mode</label>
              <div className="segmented-pills">
                <button
                  className={`pill-btn ${data.loc_mode === "coord" ? "primary" : "ghost"}`}
                  onClick={() => setLocMode(data, setData, "coord")}
                  type="button"
                >
                  Coordinates
                </button>
                <button
                  className={`pill-btn ${data.loc_mode === "station" ? "primary" : "ghost"}`}
                  onClick={() => setLocMode(data, setData, "station")}
                  type="button"
                >
                  Station
                </button>
              </div>
            </div>
          </div>

          {data.loc_mode === "coord" ? (
            <FormRow>
              <FG label="Latitude *">
                <input
                  type="number"
                  value={data.lat}
                  onChange={(e) => setCoords(data, setData, e.target.value, data.lng)}
                />
              </FG>
              <FG label="Longitude *">
                <input
                  type="number"
                  value={data.lng}
                  onChange={(e) => setCoords(data, setData, data.lat, e.target.value)}
                />
              </FG>
            </FormRow>
          ) : (
            <>
              <FormRow>
                <FG label="Existing Station" style={{ minWidth: 260 }}>
                  <select
                    value={data.station_id}
                    onChange={(e) => pickStation(data, setData, e.target.value)}
                    disabled={!data.lake_id}
                  >
                    <option value="">
                      {data.lake_id ? "Select a station…" : "Choose a lake first"}
                    </option>
                    {stationOptions(data).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FG>

                <FG label="Actions" style={{ minWidth: 220 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="pill-btn primary"
                      onClick={() => { setStationEdit(null); setStationModalOpen(true); }}
                    >
                      <FiPlus /> New Station
                    </button>
                    <button
                      className="pill-btn ghost"
                      disabled={!data.station_id}
                      onClick={() => {
                        if (!data.station_id) return;
                        setStationEdit(
                          stationOptions(data).find((s) => String(s.id) === String(data.station_id)) || null
                        );
                        setStationModalOpen(true);
                      }}
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      className="pill-btn ghost danger"
                      disabled={!data.station_id}
                      onClick={() => deleteStation(data, setData, Number(data.station_id))}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </FG>
              </FormRow>

              <FormRow>
                <FG label={`Latitude ${data.station_id ? "" : "*"}`}>
                  <input
                    type="number"
                    value={data.lat}
                    onChange={(e) => setCoords(data, setData, e.target.value, data.lng)}
                  />
                </FG>
                <FG label={`Longitude ${data.station_id ? "" : "*"}`}>
                  <input
                    type="number"
                    value={data.lng}
                    onChange={(e) => setCoords(data, setData, data.lat, e.target.value)}
                  />
                </FG>
              </FormRow>
            </>
          )}

          {/* Map */}
          <div className="map-preview" style={{ marginTop: 12 }}>
            <AppMap onClick={(e) => handleMapClick(data, setData, e)} style={{ height: 380 }}>
              {data.lake_id && lakeGeoms?.[data.lake_id] ? (
                <GeoJSON data={lakeGeoms[data.lake_id]} style={{ color: "#2563eb", weight: 2, fillOpacity: 0.1 }} />
              ) : null}

              {data.geom_point ? (
                <Marker position={[data.geom_point.lat, data.geom_point.lng]} icon={DEFAULT_ICON}>
                  <Popup>
                    <div>
                      <div><strong>Point</strong></div>
                      <div>{data.geom_point.lat?.toFixed(6)}, {data.geom_point.lng?.toFixed(6)}</div>
                      {data.station_id ? <div>Station: {data.station_name}</div> : null}
                    </div>
                  </Popup>
                </Marker>
              ) : null}

              <MapViewport bounds={mapBounds(data)} maxZoom={14} padding={[16, 16]} pad={0.02} />
            </AppMap>
          </div>

          <div className="alert-note" style={{ marginTop: 12 }}>
            Click on the map to set coordinates. Create or edit stations via the modal.
          </div>

          {/* Station Modal */}
          <StationModal
            open={stationModalOpen}
            onClose={() => setStationModalOpen(false)}
            lakeId={data.lake_id}
            stations={stationOptions(data)}
            editing={stationEdit}
            onCreate={(station) => createStation(data, setData, station)}
            onUpdate={(station) => updateStation(data, setData, station)}
            onDelete={(id) => deleteStation(data, setData, id)}
          />
        </div>
      ),
    },

    // Step 2: Sampling Details
    {
      key: STEP_LABELS[1].key,
      title: STEP_LABELS[1].title,
      canNext: (d) => !!d.sampled_at,
      render: ({ data, setData }) => (
        <div className="wizard-pane">
          <FormRow>
            <FG label="Date & Time *">
              <input
                type="datetime-local"
                value={data.sampled_at}
                onChange={(e) => setData({ ...data, sampled_at: e.target.value })}
              />
            </FG>
            <FG label="Method">
              <input
                value={data.method}
                onChange={(e) => setData({ ...data, method: e.target.value })}
              />
            </FG>
            <FG label="Sampler Name">
              <input
                value={data.sampler_name}
                onChange={(e) => setData({ ...data, sampler_name: e.target.value })}
              />
            </FG>
            <FG label="Weather">
              <input
                value={data.weather}
                onChange={(e) => setData({ ...data, weather: e.target.value })}
              />
            </FG>
          </FormRow>
        </div>
      ),
    },

    // Step 3: Parameters
    {
      key: STEP_LABELS[2].key,
      title: STEP_LABELS[2].title,
      canNext: (d) =>
        (d.results || []).length > 0 &&
        (d.results || []).every((r) => r.parameter_id && r.value !== ""),
      render: ({ data, setData }) => (
        <div className="wizard-pane">
          <div className="wizard-nav" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
            <button className="pill-btn primary" onClick={() => addRow(data, setData)}>
              <FiPlus /> Add Row
            </button>
          </div>

          <div className="table-wrapper">
            <table className="lv-table">
              <thead>
                <tr>
                  <th className="lv-th"><div className="lv-th-inner"><span className="lv-th-label">Parameter</span></div></th>
                  <th className="lv-th" style={{ width: 140 }}><div className="lv-th-inner"><span className="lv-th-label">Value</span></div></th>
                  <th className="lv-th" style={{ width: 110 }}><div className="lv-th-inner"><span className="lv-th-label">Unit</span></div></th>
                  <th className="lv-th" style={{ width: 140 }}><div className="lv-th-inner"><span className="lv-th-label">Depth (m)</span></div></th>
                  <th className="lv-th"><div className="lv-th-inner"><span className="lv-th-label">Remarks</span></div></th>
                  <th className="lv-th" style={{ width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {(data.results || []).map((r) => (
                  <tr key={r.tempId}>
                    <td>
                      <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                        <select
                          value={r.parameter_id}
                          onChange={(e) => patchRow(data, setData, r.tempId, { parameter_id: e.target.value })}
                        >
                          <option value="">Select…</option>
                          {parameterOptions.map((p) => (
                            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td>
                      <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                        <input
                          type="number"
                          value={r.value}
                          onChange={(e) => patchRow(data, setData, r.tempId, { value: e.target.value })}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                        <input
                          value={r.unit}
                          onChange={(e) => patchRow(data, setData, r.tempId, { unit: e.target.value })}
                          placeholder="auto"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                        <input
                          type="number"
                          value={r.depth_m}
                          onChange={(e) => patchRow(data, setData, r.tempId, { depth_m: e.target.value })}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                        <input
                          value={r.remarks}
                          onChange={(e) => patchRow(data, setData, r.tempId, { remarks: e.target.value })}
                        />
                      </div>
                    </td>
                    <td>
                      <button className="pill-btn ghost danger" onClick={() => rmRow(data, setData, r.tempId)} title="Remove">
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
                {!(data.results || []).length && (
                  <tr><td colSpan={6} className="lv-empty">No parameters yet. Click “Add Row”.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="alert-note" style={{ marginTop: 12 }}>
            Multiple DO values at different depths? Add several DO rows with different Depth (m).
          </div>
        </div>
      ),
    },

    // Step 4: Standard & Notes (+ Status with role gating)
    {
      key: STEP_LABELS[3].key,
      title: STEP_LABELS[3].title,
      render: ({ data, setData }) => (
        <div className="wizard-pane">
          <FormRow>
            <FG label="Applied Standard (DAO)">
              <select
                value={data.applied_standard_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const std = standardOptions.find((s) => String(s.id) === String(id));
                  setData({
                    ...data,
                    applied_standard_id: id,
                    applied_standard_code: std?.code || "",
                  });
                }}
              >
                <option value="">None</option>
                {standardOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} {s.is_current ? "(current)" : ""}
                  </option>
                ))}
              </select>
            </FG>

            <FG label="Status">
              <select
                value={data.status}
                onChange={(e) => setData({ ...data, status: e.target.value })}
                disabled={!canPublish}
              >
                <option value="draft">Draft</option>
                {canPublish && <option value="published">Published</option>}
              </select>
              {!canPublish && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                  Only org-admins can publish. Contributors can save as Draft.
                </div>
              )}
            </FG>

            <FG label="Notes" style={{ flexBasis: "100%" }}>
              <input
                value={data.notes}
                onChange={(e) => setData({ ...data, notes: e.target.value })}
              />
            </FG>
          </FormRow>

          <div className="alert-note" style={{ marginTop: 12 }}>
            Threshold selection is informational here; wire the evaluation on the backend using parameter thresholds.
          </div>
        </div>
      ),
    },

    // Step 5: Review (show derived period preview)
    {
      key: STEP_LABELS[4].key,
      title: STEP_LABELS[4].title,
      render: ({ data }) => {
        const d = data.sampled_at ? new Date(data.sampled_at) : null;
        const yr = d ? d.getFullYear() : null;
        const mo = d ? d.getMonth() + 1 : null;
        const qt = d ? Math.floor((mo - 1) / 3) + 1 : null;
        return (
          <div className="wizard-pane">
            <div className="dashboard-card" style={{ marginBottom: 12 }}>
              <div className="dashboard-card-title"><FiMapPin /> Context</div>
              <div className="dashboard-card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><strong>Organization:</strong> {organization?.name || data.organization_name || "—"}</div>
                <div><strong>Lake:</strong> {data.lake_name || "—"}</div>
                <div><strong>Lake Class:</strong> {data.lake_class_code || "—"}</div>
                <div><strong>Location Mode:</strong> {data.loc_mode === "coord" ? "Coordinates" : "Station"}</div>
                <div><strong>Point:</strong> {data.geom_point ? `${data.geom_point.lat?.toFixed(6)}, ${data.geom_point.lng?.toFixed(6)}` : "—"}</div>
                <div><strong>Station:</strong> {data.station_id ? data.station_name : "—"}</div>
                <div><strong>Sampled At:</strong> {data.sampled_at || "—"}</div>
                <div><strong>Period:</strong> {d ? `${yr} · Q${qt} · M${String(mo).padStart(2,"0")}` : "—"}</div>
                <div><strong>Sampler:</strong> {data.sampler_name || "—"}</div>
                <div><strong>Method:</strong> {data.method || "—"}</div>
                <div><strong>Weather:</strong> {data.weather || "—"}</div>
                <div><strong>Status:</strong> {data.status || "draft"}</div>
              </div>
            </div>

            <div className="dashboard-card" style={{ marginBottom: 12 }}>
              <div className="dashboard-card-title"><FiThermometer /> Parameters</div>
              {!((data.results || []).length) ? (
                <div className="no-data">No parameters.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="lv-table">
                    <thead>
                      <tr>
                        <th className="lv-th"><div className="lv-th-inner"><span className="lv-th-label">Parameter</span></div></th>
                        <th className="lv-th"><div className="lv-th-inner"><span className="lv-th-label">Value</span></div></th>
                        <th className="lv-th"><div className="lv-th-inner"><span className="lv-th-label">Unit</span></div></th>
                        <th className="lv-th"><div className="lv-th-inner"><span className="lv-th-label">Depth (m)</span></div></th>
                        <th className="lv-th"><div className="lv-th-inner"><span className="lv-th-label">Remarks</span></div></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.results || []).map((r) => {
                        const p = parameterOptions.find((pp) => String(pp.id) === String(r.parameter_id));
                        return (
                          <tr key={r.tempId}>
                            <td>{p ? `${p.code} — ${p.name}` : r.parameter_code || "—"}</td>
                            <td>{r.value !== "" && r.value !== null ? r.value : "—"}</td>
                            <td>{r.unit || p?.unit || "—"}</td>
                            <td>{r.depth_m !== "" && r.depth_m !== null ? r.depth_m : "—"}</td>
                            <td>{r.remarks || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-title"><FiClipboard /> Standard & Notes</div>
              <div className="dashboard-card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><strong>Standard:</strong> {data.applied_standard_code || "—"}</div>
                <div><strong>Notes:</strong> {data.notes || "—"}</div>
              </div>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="wizard-container">
      <Wizard
        steps={steps}
        initialData={initialData}
        labels={{ back: "Prev", next: "Next", finish: "Submit" }}
        onFinish={submit}
      />
    </div>
  );
}
