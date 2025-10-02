import React, { useEffect, useState, useCallback } from 'react';
import { getCurrentUser } from '../../lib/authState';
import useSettingsMode from './useSettingsMode';
import useUpdateSelf from './useUpdateSelf';
import api from '../../lib/api';
import Swal from 'sweetalert2';

/**
 * Reusable Settings form allowing user to update name & password.
 * Props: showTenant (boolean) to display tenant info if available.
 */
export default function SettingsForm({ context = 'public', onUpdated }) {
  const [user, setUser] = useState(() => getCurrentUser());
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  // Tenant editing (org_admin only)
  const [tenantName, setTenantName] = useState(() => (user?.tenant?.name || user?.tenant_name || user?.tenant || ''));
  const [tenantEditing, setTenantEditing] = useState(false);
  const [tenantSaving, setTenantSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const { mode, showSection, canEdit } = useSettingsMode({ user, context });
  const { update, loading, error, success, resetStatus } = useUpdateSelf();

  useEffect(() => {
  function handleUpdate(e) { setUser(e.detail); setName(e.detail?.name || ''); setTenantName(e.detail?.tenant?.name || e.detail?.tenant_name || e.detail?.tenant || ''); }
    window.addEventListener('lv-user-update', handleUpdate);
    return () => window.removeEventListener('lv-user-update', handleUpdate);
  }, []);

  function resetPasswordFields() {
    setCurrentPassword('');
    setPassword('');
    setPassword2('');
  }

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    resetStatus();
    setLocalError('');
    if (showPasswordSection && (password || password2 || currentPassword)) {
      if (password !== password2) { setLocalError('Passwords do not match.'); return; }
      if (!currentPassword) { setLocalError('Current password is required.'); return; }
    }
    const payload = {};
    if (name && name !== user?.name && canEdit('name')) payload.name = name;
    if (showPasswordSection && password && canEdit('password')) {
      if (password !== password2) { return; }
      if (!currentPassword) { return; }
      payload.password = password;
      payload.password_confirmation = password2;
      payload.current_password = currentPassword;
    }
    const res = await update(payload);
    if (res?.user) { setUser(res.user); setName(res.user.name); }
    if (payload.password) resetPasswordFields();
    onUpdated?.(res?.user);
  }, [password,password2,currentPassword,name,user,canEdit,update,onUpdated,showPasswordSection]);

  if (!user) return <div className="lv-settings-box"><p>You must be logged in to manage settings.</p></div>;

  const showTenant = showSection('tenant') && (user.tenant || user.tenant_id);
  const canEditTenant = user?.role === 'org_admin';

  const submitTenant = async () => {
    if (!canEditTenant) return;
    const newName = tenantName?.trim();
    if (!newName) { Swal.fire('Validation','Tenant name is required','warning'); return; }
    const currentName = (user?.tenant?.name || user?.tenant_name || (typeof user?.tenant === 'string' ? user.tenant : ''));
    if (newName === currentName) { setTenantEditing(false); return; }
    const tid = user?.tenant_id || user?.tenant?.id || (Array.isArray(user?.tenants) && user.tenants[0]?.id) || null;
    if (!tid) { Swal.fire('Error','Unable to resolve tenant id','error'); return; }
    setTenantSaving(true);
    try {
      // Call new org-scoped tenant rename endpoint
      const res = await api.patch(`/org/${tid}/tenant`, { name: newName });
      const updated = res?.data || res;
      if (updated) {
        Swal.fire({ toast:true, position:'top-end', timer:1600, showConfirmButton:false, icon:'success', title:'Tenant name updated' });
        const nextUser = { ...user };
        if (nextUser.tenant && typeof nextUser.tenant === 'object') nextUser.tenant = { ...nextUser.tenant, name: newName };
        if (nextUser.tenant_name) nextUser.tenant_name = newName;
        if (typeof nextUser.tenant === 'string') nextUser.tenant = newName;
        window.dispatchEvent(new CustomEvent('lv-user-update', { detail: nextUser }));
        setTenantEditing(false);
      }
    } catch (e) {
      console.error('Tenant update failed', e);
      const msg = e?.response?.data?.message || (e?.response?.status === 403 ? 'You do not have permission to edit tenant name.' : 'Unable to update tenant name');
      Swal.fire('Update failed', msg, 'error');
    } finally {
      setTenantSaving(false);
    }
  };
  const showPassword = showSection('password');

  return (
    <div className="lv-modern-settings" data-mode={mode}>
      <div className="settings-header">
        <h2>Account Settings</h2>
        <div className="settings-subtext">Manage your account details and security preferences.</div>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <fieldset disabled={loading} style={{ border: 'none', padding: 0, margin: 0 }}>
          <div className={`lv-settings-grid ${showPassword ? 'two-col' : ''}`}>
            <div className="lv-settings-panel">
              <h3>Profile</h3>
              <div className="lv-field-row">
                <label>Name</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} maxLength={255} disabled={!canEdit('name')} />
              </div>
              <div className="lv-field-row">
                <label>Email</label>
                <input type="email" value={user.email} disabled readOnly />
              </div>
              {showTenant && (
                <div className="lv-field-row">
                  <label>Tenant</label>
                  {!tenantEditing && (
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input type="text" value={tenantName || `Tenant #${user.tenant_id}`} disabled readOnly />
                      {canEditTenant && (
                        <button type="button" className="pill-btn ghost sm" onClick={()=>setTenantEditing(true)}>Edit</button>
                      )}
                    </div>
                  )}
                  {tenantEditing && (
                    <div style={{ display:'flex', gap:8, alignItems:'center', width:'100%' }}>
                      <input type="text" value={tenantName} onChange={e=>setTenantName(e.target.value)} maxLength={255} disabled={tenantSaving} style={{ flex:1 }} />
                      <button type="button" className="pill-btn primary sm" disabled={tenantSaving} onClick={submitTenant}>{tenantSaving ? 'Saving…' : 'Save'}</button>
                      <button type="button" className="pill-btn ghost sm" disabled={tenantSaving} onClick={()=>{ setTenantEditing(false); setTenantName(user?.tenant?.name || user?.tenant_name || user?.tenant || ''); }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
              {success && <div className="lv-status-success" role="status">{success}</div>}
              {error && <div className="lv-status-error" role="alert">{error}</div>}
              {localError && <div className="lv-status-error" role="alert">{localError}</div>}
            </div>
            {showPassword && (
              <div className="lv-settings-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>Password</h3>
                  <button type="button" className="password-collapse-toggle" onClick={() => setShowPasswordSection(v=>!v)}>
                    {showPasswordSection ? 'Hide' : 'Change'}
                  </button>
                </div>
                {showPasswordSection && (
                  <div className="password-section">
                    <div className="lv-field-row">
                      <label>Current Password</label>
                      <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} placeholder="Enter current password" autoComplete="current-password" disabled={!canEdit('password')} />
                    </div>
                    <div className="lv-field-row">
                      <label>New Password</label>
                      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="(leave blank to keep)" autoComplete="new-password" disabled={!canEdit('password')} />
                    </div>
                    <div className="lv-field-row">
                      <label>Confirm New Password</label>
                      <input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} autoComplete="new-password" disabled={!canEdit('password')} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="settings-actions">
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
