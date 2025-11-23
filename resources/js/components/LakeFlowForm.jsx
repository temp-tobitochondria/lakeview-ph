import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import CoordinatePicker from './CoordinatePicker';

const EMPTY = { id:null, lake_id:'', flow_type:'inflow', name:'', alt_name:'', source:'', is_primary:false, notes:'', lat:'', lon:'' };

export default function LakeFlowForm({ open, mode='create', initialValue=EMPTY, lakes=[], lakesLoading=false, loading=false, onSubmit, onCancel }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(()=>{ 
    const mapped = { ...EMPTY, ...initialValue, flow_type: initialValue.flow_type || 'inflow' };
    // Map latitude/longitude to lat/lon for form
    if (initialValue.latitude != null) mapped.lat = initialValue.latitude;
    if (initialValue.longitude != null) mapped.lon = initialValue.longitude;
    setForm(mapped);
  }, [initialValue, open]);

  const submit = (e) => {
    e?.preventDefault?.();
    if (!form.lake_id) return;
    const payload = { ...form };
    if (payload.lat === '') payload.lat = undefined;
    if (payload.lon === '') payload.lon = undefined;
    onSubmit?.(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={mode==='create'?'Add Tributary':'Edit Tributary'}
      ariaLabel="Lake Tributary Form"
      width={720}
      footer={<div className="lv-modal-actions">
        <button type="button" className="pill-btn ghost" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className="pill-btn primary" form="lv-flow-form" disabled={loading}>{loading?'Saving...':(mode==='create'?'Create':'Save')}</button>
      </div>}
    >
      <form id="lv-flow-form" onSubmit={submit} className="lv-grid-2">
        <label className="lv-field">
          <span>Lake*</span>
          <select value={form.lake_id} required onChange={e=>setForm(f=>({...f,lake_id:e.target.value}))} disabled={lakesLoading}>
            <option value="">{lakesLoading ? 'Loading lakes...' : 'Select lake'}</option>
            {!lakesLoading && lakes.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="lv-field">
          <span>Type*</span>
          <select value={form.flow_type} onChange={e=>setForm(f=>({...f,flow_type:e.target.value}))}>
            <option value="inflow">Inlet</option>
            <option value="outflow">Outlet</option>
          </select>
        </label>
        <label className="lv-field">
          <span>Name*</span>
          <input value={form.name} required onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        </label>
        <label className="lv-field">
          <span>Alt Name</span>
          <input value={form.alt_name} onChange={e=>setForm(f=>({...f,alt_name:e.target.value}))} />
        </label>
        <label className="lv-field">
          <span>Source*</span>
          <input value={form.source} required onChange={e=>setForm(f=>({...f,source:e.target.value}))} placeholder="e.g. Agos River" />
        </label>
        <label className="lv-field">
          <span>Primary?</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`pill-btn ${form.is_primary ? 'primary' : 'ghost'}`}
              aria-pressed={!!form.is_primary}
              onClick={() => setForm(f => ({ ...f, is_primary: !f.is_primary }))}
              style={{ padding: '6px 10px' }}
            >
              {form.is_primary ? 'Primary' : 'Mark primary'}
            </button>
          </div>
        </label>
        <label className="lv-field" style={{gridColumn:'1 / span 2'}}>
          <span>Notes</span>
          <textarea rows={3} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
        </label>
        <div className="lv-field" style={{gridColumn:'1 / span 2'}}>
          <strong style={{fontSize:14}}>Coordinates</strong>
          <div style={{display:'flex',gap:16,flexWrap:'wrap', marginTop:8}}>
            <label className="lv-field" style={{flex:'1 1 160px'}}>
              <span>Latitude*</span>
              <input type="number" step="0.000001" placeholder="14.1702" value={form.lat} onChange={e=>setForm(f=>({...f,lat:e.target.value}))} />
            </label>
            <label className="lv-field" style={{flex:'1 1 160px'}}>
              <span>Longitude*</span>
              <input type="number" step="0.000001" placeholder="121.2245" value={form.lon} onChange={e=>setForm(f=>({...f,lon:e.target.value}))} />
            </label>
            <CoordinatePicker form={form} setForm={setForm} showLakeLayer={true} lakeId={form.lake_id || null} />
          </div>
        </div>
      </form>
    </Modal>
  );
}

