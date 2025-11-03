// resources/js/pages/AdminInterface/AdminKycProfiles.jsx
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { cachedGet, invalidateHttpCache } from '../../lib/httpCache';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AdminKycProfiles() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('submitted');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await cachedGet('/admin/kyc-profiles', { params: { status }, ttlMs: 5 * 60 * 1000 });
      setRows(res?.data || []);
    } catch (e) {
      try { const j = JSON.parse(e?.message||''); setError(j?.message || 'Failed to load.'); } catch { setError('Failed to load.'); }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [status]);

  const decide = async (id, action) => {
    const notes = action === 'reject' ? window.prompt('Reviewer notes (optional):', '') : '';
    try {
      await api.post(`/admin/kyc-profiles/${id}/decision`, { action, notes });
      try { invalidateHttpCache('/admin/kyc-profiles'); } catch {}
      await load();
    } catch (e) {
      alert('Decision failed.');
    }
  };

  return (
    <div className="content-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title" style={{ margin: 0 }}>KYC Profiles</h1>
        <div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          {loading && <div>Loading…</div>}
          {error && <div className="alert error">{String(error)}</div>}
          {!loading && !error && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Full Name</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Reviewed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="muted">No records</td></tr>
                  )}
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.user?.name}<div className="muted" style={{ fontSize: 12 }}>{r.user?.email}</div></td>
                      <td>{r.full_name || '—'}</td>
                      <td>{r.status}</td>
                      <td>{r.submitted_at || '—'}</td>
                      <td>{r.reviewed_at || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.status !== 'verified' && (
                          <button className="btn" onClick={() => decide(r.id, 'approve')}>Approve</button>
                        )}
                        {r.status !== 'rejected' && (
                          <button className="btn red" style={{ marginLeft: 8 }} onClick={() => decide(r.id, 'reject')}>Reject</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
