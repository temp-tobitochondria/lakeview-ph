import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import api from '../lib/api';

/**
 * KycProfileModal
 * Shows Step 2 (Profile details) of the KYC wizard for a given user.
 * Fields: full_name, dob, id_type, id_number, address_line1, city, province, postal_code
 */
export default function KycProfileModal({ open, onClose, userId, orgTenantId = null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!open || !userId) return;
    let alive = true;
    (async () => {
      setLoading(true); setError(null); setProfile(null);
      try {
        // Org admins should access via org-scoped endpoint; admins via admin endpoint
        let res;
        if (orgTenantId) {
          res = await api.get(`/org/${orgTenantId}/users/${userId}/kyc-docs`);
        } else {
          res = await api.get(`/admin/kyc-profiles/user/${userId}`);
        }
        if (!alive) return;
        // API returns shape: { data: <profile|null>, documents: [...] } for org/admin; tolerate plain profile too
        const payload = res?.data;
        const profileData = (payload && typeof payload === 'object') ? (payload.data ?? payload) : null;
        setProfile(profileData ?? null);
      } catch (e) {
        if (!alive) return;
        // For forbidden or restricted, show as unavailable (no error alert)
        const status = e?.response?.status;
        if (status === 403) {
          setProfile(null);
          setError(null);
        } else {
          setError('Failed to load KYC profile');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, userId, orgTenantId]);

  const Field = ({ label, value }) => (
    <div style={{ display: 'grid', gap: 4 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value ? String(value) : '—'}</div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={profile ? `User Information Profile — ${profile.full_name || ''}` : 'User Information Profile'}
      width={720}
      footer={<div className="lv-modal-actions"><button type="button" className="pill-btn" onClick={onClose}>Close</button></div>}
    >
      {loading && <div>Loading…</div>}
      {error && <div className="alert error">{String(error)}</div>}
      {!loading && !error && (
        profile ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Full Name" value={profile.full_name} />
              <Field label="Date of Birth" value={profile.dob} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="ID Type" value={profile.id_type} />
              <Field label="ID Number" value={profile.id_number} />
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Address" value={profile.address_line1} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <Field label="City" value={profile.city} />
                <Field label="Province" value={profile.province} />
                <Field label="Postal Code" value={profile.postal_code} />
              </div>
            </div>
          </div>
        ) : (
          <div className="muted">Information for this User is Unavailable</div>
        )
      )}
    </Modal>
  );
}
