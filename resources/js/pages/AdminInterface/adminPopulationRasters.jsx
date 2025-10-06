import React, { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';

// Simple superadmin page to list & upload population raster files (GeoTIFF or ZIP)
export default function AdminPopulationRasters() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [notes, setNotes] = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get('/admin/population-rasters');
      const list = Array.isArray(resp?.data) ? resp.data : [];
      setRows(list.filter(Boolean));
    } catch (e) {
      setError('Failed to load rasters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onUpload = async (e) => {
    e.preventDefault();
    if (!fileRef.current?.files?.[0]) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('year', year);
      form.append('raster', fileRef.current.files[0]);
      if (notes) form.append('notes', notes);
  const resp = await api.upload('/admin/population-rasters', form);
  const created = resp?.data || null;
  setRows(r => [created, ...r].filter(Boolean));
      fileRef.current.value = '';
      setNotes('');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Upload failed';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Population Rasters</h1>
      <p style={{ maxWidth: 680 }}>Upload GeoTIFF (or ZIP of rasters) for population datasets. After upload, a separate ingestion process should register the raster in PostGIS and link it to population functions (not yet automated here).</p>

      <form onSubmit={onUpload} style={{ display: 'grid', gap: 12, maxWidth: 520, padding: 16, border: '1px solid #eee', borderRadius: 12 }}>
        <div>
          <label style={{ fontWeight: 600 }}>Year</label><br />
          <input type="number" value={year} min={1990} max={2100} onChange={e => setYear(parseInt(e.target.value, 10) || year)} required />
        </div>
        <div>
          <label style={{ fontWeight: 600 }}>Raster File (.tif or .zip)</label><br />
          <input type="file" accept=".tif,.tiff,.zip" ref={fileRef} required />
        </div>
        <div>
          <label style={{ fontWeight: 600 }}>Notes (optional)</label><br />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ width: '100%' }} placeholder="Source, resolution, citation..." />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" disabled={uploading} style={{ padding: '8px 16px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          {error && <span style={{ color: '#b91c1c' }}>{error}</span>}
        </div>
      </form>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 8 }}>Uploaded Files</h2>
        {loading && <div>Loading…</div>}
        {!loading && rows.length === 0 && <div style={{ color: '#555' }}>No rasters uploaded yet.</div>}
        {!loading && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Year</th>
                  <th style={thStyle}>Original Filename</th>
                  <th style={thStyle}>Stored Path</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Uploaded</th>
                  <th style={thStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={tdStyle}>{r.id}</td>
                    <td style={tdStyle}>{r.year}</td>
                    <td style={tdStyle}>{r.filename}</td>
                    <td style={tdStyle}>{r.path}</td>
                    <td style={tdStyle}>{r.status}</td>
                    <td style={tdStyle}>{new Date(r.created_at).toLocaleString()}</td>
                    <td style={{ ...tdStyle, maxWidth: 240 }}>{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #e2e8f0' };
const tdStyle = { padding: '6px 10px', fontSize: 13 };
