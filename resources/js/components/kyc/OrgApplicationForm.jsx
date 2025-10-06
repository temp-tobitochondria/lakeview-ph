import React, { useState } from "react";

export default function OrgApplicationForm({ tenants = [], onSubmit, submitting = false, error = null }) {
  const [tenantId, setTenantId] = useState(tenants?.[0]?.id || "");
  const [role, setRole] = useState("contributor");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId || !role) return;
    await onSubmit?.({ tenant_id: Number(tenantId), desired_role: role });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      <label>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Select Organization</div>
        <select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          required
          style={{ width: '100%', padding: '8px 10px' }}
        >
          <option value="" disabled>Choose an organization…</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      <fieldset style={{ border: '1px solid #e6eaf0', borderRadius: 8, padding: 12 }}>
        <legend style={{ padding: '0 6px' }}>Desired Role</legend>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <input type="radio" name="role" value="contributor" checked={role === 'contributor'} onChange={() => setRole('contributor')} />
          <span>Contributor</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="radio" name="role" value="org_admin" checked={role === 'org_admin'} onChange={() => setRole('org_admin')} />
          <span>Org Admin (longer review)</span>
        </label>
      </fieldset>

      {error && (
        <div style={{ color: '#b42318', background: '#fee4e2', border: '1px solid #fda29b', padding: 10, borderRadius: 8 }}>
          {String(error)}
        </div>
      )}

      <div>
        <button type="submit" disabled={submitting || !tenantId} className="auth-btn">
          {submitting ? 'Submitting…' : 'Submit Application'}
        </button>
      </div>
    </form>
  );
}
