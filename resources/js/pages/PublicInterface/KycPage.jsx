import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../../lib/authState";
import { getKycStatus, listTenantsOptions, createOrgApplication } from "../../lib/api";
import api from "../../lib/api";
import { toastSuccess, toastError } from "../../utils/alerts";
import Modal from "../../components/Modal";

export default function KycPage({ embedded = true }) {
  const user = getCurrentUser();
  const role = useMemo(() => (user?.role || null), [user]);
  const [kyc, setKyc] = useState({ status: null });
  const [tenants, setTenants] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitOk, setSubmitOk] = useState(false);
  const [kycProfile, setKycProfile] = useState(null);
  const [kycDocs, setKycDocs] = useState([]);
  const [kycSaving, setKycSaving] = useState(false);
  const [kycSubmitting, setKycSubmitting] = useState(false);
  // Wizard state
  const [step, setStep] = useState(1); // 1: Choose Org, 2: Profile, 3: Documents
  const [chosenTenantId, setChosenTenantId] = useState("");
  const [desiredRole, setDesiredRole] = useState("contributor");
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  // Step 2: ID type selection state
  const [idTypeSel, setIdTypeSel] = useState("");
  const [idTypeOther, setIdTypeOther] = useState("");

  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        if (user) {
          try {
            const s = await getKycStatus(); if (mounted) setKyc(s?.data || {});
            const p = await api.get('/kyc/profile'); if (mounted) { setKycProfile(p?.data || null); setKycDocs(p?.documents || []); }
          } catch {}
          try { const t = await listTenantsOptions(); if (mounted) setTenants(t?.data || []); } catch {}
        }
      } catch {}
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [user]);

  // Derive ID type select state from loaded profile
  useEffect(() => {
    const t = (kycProfile?.id_type || "").trim();
    if (!t) { setIdTypeSel(""); setIdTypeOther(""); return; }
    const lc = t.toLowerCase();
    if (["passport"].includes(lc)) { setIdTypeSel("passport"); setIdTypeOther(""); }
    else if (["national id","national_id","philid","phil id","nid"].includes(lc)) { setIdTypeSel("national_id"); setIdTypeOther(""); }
    else if (lc.includes("driver")) { setIdTypeSel("drivers_license"); setIdTypeOther(""); }
    else { setIdTypeSel("other"); setIdTypeOther(t); }
  }, [kycProfile?.id_type]);

  // Wizard helpers
  const next = () => setStep((s) => Math.min(3, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const validateStep1 = () => {
    const e = {};
    if (!chosenTenantId) e.tenant = 'Please choose an organization';
    if (!desiredRole) e.role = 'Please choose a role';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const validateStep2 = (formEl) => {
    const e = {};
    const full_name = formEl?.full_name?.value?.trim();
    const sel = formEl?.id_type_select?.value || "";
    const other = formEl?.id_type_other?.value?.trim();
    const id_type = sel === 'other' ? other : sel;
    const id_number = formEl?.id_number?.value?.trim();
    if (!full_name) e.full_name = 'Full name is required';
    if (!id_type) e.id_type = 'ID type is required';
    if (!id_number) e.id_number = 'ID number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveKyc = async (e) => {
    e?.preventDefault?.();
    setKycSaving(true);
    try {
      const sel = e.target.id_type_select.value;
      const other = e.target.id_type_other?.value?.trim();
      const resolvedIdType = sel === 'other' ? other : sel;
      const payload = {
        full_name: e.target.full_name.value,
        dob: e.target.dob.value,
        id_type: resolvedIdType,
        id_number: e.target.id_number.value,
        address_line1: e.target.address_line1.value,
        city: e.target.city.value,
        province: e.target.province.value,
        postal_code: e.target.postal_code.value,
      };
      const res = await api.patch('/kyc/profile', payload);
      setKycProfile(res?.data || {});
      toastSuccess('KYC profile saved');
    } catch (err) {
      toastError('Save failed', 'Please review your inputs.');
    } finally { setKycSaving(false); }
  };

  const uploadDoc = async (e) => {
    const file = e.target.files?.[0];
    const type = e.target.getAttribute('data-type');
    if (!file || !type) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    try {
      const res = await api.upload('/kyc/documents', fd);
      setKycDocs((d) => [...d, res?.data].filter(Boolean));
      toastSuccess('Document uploaded');
    } catch { toastError('Upload failed'); }
    finally { e.target.value = ''; }
  };

  const deleteDoc = async (id) => {
    try { await api.delete(`/kyc/documents/${id}`); setKycDocs((d) => d.filter(x => x.id !== id)); }
    catch { toastError('Delete failed'); }
  };

  const submitKyc = async () => {
    setKycSubmitting(true);
    try {
      const res = await api.post('/kyc/submit');
      // refresh status/profile
      try { const s = await getKycStatus(); setKyc(s?.data || {}); } catch {}
      try { const p = await api.get('/kyc/profile'); setKycProfile(p?.data || null); setKycDocs(p?.documents || []); } catch {}
      toastSuccess(res?.message || 'KYC submitted for review');
    } catch (e) {
      const msg = (() => { try { const j = JSON.parse(e?.message||''); return j?.message || 'Please try again.'; } catch { return 'Please try again.'; } })();
      toastError('Submit failed', msg);
    } finally { setKycSubmitting(false); }
  };

  const finalizeApplication = async () => {
    // Require at least one document before final submission
    if (!kycDocs || kycDocs.length === 0) {
      setSubmitError('Please upload at least one document before submitting.');
      return;
    }
    setSubmitError(null); setSubmitOk(false); setSubmitting(true);
    try {
      // Best-effort KYC submit first (if already submitted, API will 422 and be ignored here)
      try { await api.post('/kyc/submit'); } catch (_) {}
      const res = await createOrgApplication({ tenant_id: Number(chosenTenantId), desired_role: desiredRole });
      setSubmitOk(true);
      if (res?.message) toastSuccess(res.message);
    } catch (e) {
      const msg = (() => { try { const j = JSON.parse(e?.message||''); return j?.message || 'Please try again.'; } catch { return 'Please try again.'; } })();
      setSubmitError(msg);
      toastError('Application failed', msg);
    } finally { setSubmitting(false); }
  };

  const header = (
    <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h1 className="page-title" style={{ margin: 0, fontWeight: 700 }}>Join an Organization</h1>
        <div className="page-subtitle" style={{ marginTop: 6 }}>Step-by-step: choose organization → complete profile → upload documents.</div>
      </div>
    </div>
  );

  const content = (
    <>
      {!user && (
        <div className="card" style={{ marginBottom: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div className="card-body" style={{ padding: 16 }}>
            <strong>You're not signed in.</strong>
            <div style={{ marginTop: 4 }}>Please sign in or create an account to access KYC and organization applications.</div>
          </div>
        </div>
      )}

      {user && role === 'public' && (
        <Modal open={true} onClose={() => navigate(-1)} title="Join an Organization" width={860}>
          <div style={{ color: '#6b7280', marginBottom: 12 }}>Step {step} of 3</div>
            {/* Step 1: Choose Organization */}
            {step === 1 && (
              <div style={{ display: 'grid', gap: 12 }}>
                <label>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Select Organization</div>
                  <select
                    value={chosenTenantId}
                    onChange={(e) => setChosenTenantId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px' }}
                  >
                    <option value="" disabled>{loading ? 'Loading organizations…' : 'Choose an organization…'}</option>
                    {(tenants || []).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Pick the organization you want to join.</div>
                </label>
                {errors.tenant && <div style={{ color: '#b42318' }}>{errors.tenant}</div>}

                <fieldset style={{ border: '1px solid #e6eaf0', borderRadius: 8, padding: 12 }}>
                  <legend style={{ padding: '0 6px' }}>Desired Role</legend>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input type="radio" name="desired_role" value="contributor" checked={desiredRole === 'contributor'} onChange={() => setDesiredRole('contributor')} />
                    <span>Contributor</span>
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="radio" name="desired_role" value="org_admin" checked={desiredRole === 'org_admin'} onChange={() => setDesiredRole('org_admin')} />
                    <span>Org Admin (longer review)</span>
                  </label>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Choose the role you prefer. Org Admin may take longer to review.</div>
                </fieldset>
                {errors.role && <div style={{ color: '#b42318' }}>{errors.role}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button className="auth-btn" type="button" onClick={() => { if (validateStep1()) next(); }} disabled={!tenants?.length}>Next</button>
                </div>
              </div>
            )}

            {/* Step 2: Profile */}
            {step === 2 && (
              <form className="kyc-form" onSubmit={(e) => { if (!validateStep2(e.target)) { e.preventDefault(); return; } saveKyc(e).then(() => next()); }} style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                    <label>Full Name
                      <input name="full_name" type="text" defaultValue={kycProfile?.full_name || ''} className="input" />
                      <div style={{ fontSize: 12, color: errors.full_name ? '#b42318' : '#6b7280', marginTop: 4 }}>{errors.full_name || 'Your full legal name as shown on ID.'}</div>
                    </label>
                    <label>Date of Birth
                      <input name="dob" type="date" defaultValue={kycProfile?.dob || ''} className="input" />
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>YYYY-MM-DD</div>
                    </label>
                  </div>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                    <label>ID Type
                      <select name="id_type_select" value={idTypeSel} onChange={(e) => setIdTypeSel(e.target.value)} className="input">
                        <option value="">Select type…</option>
                        <option value="passport">Passport</option>
                        <option value="national_id">National ID</option>
                        <option value="drivers_license">Driver’s License</option>
                        <option value="other">Other</option>
                      </select>
                      {idTypeSel === 'other' && (
                        <input name="id_type_other" type="text" value={idTypeOther} onChange={(e) => setIdTypeOther(e.target.value)} placeholder="Specify ID type" className="input" style={{ marginTop: 8 }} />
                      )}
                      <div style={{ fontSize: 12, color: errors.id_type ? '#b42318' : '#6b7280', marginTop: 4 }}>{errors.id_type || 'e.g., Passport, National ID, Driver’s License, or specify other.'}</div>
                    </label>
                    <label>ID Number
                      <input name="id_number" type="text" defaultValue={kycProfile?.id_number || ''} className="input" />
                      <div style={{ fontSize: 12, color: errors.id_number ? '#b42318' : '#6b7280', marginTop: 4 }}>{errors.id_number || 'Enter exactly as shown on the ID.'}</div>
                    </label>
                  </div>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr' }}>
                    <label>Address
                      <input name="address_line1" type="text" defaultValue={kycProfile?.address_line1 || ''} className="input" />
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Street address, Purok/Barangay if applicable.</div>
                    </label>
                  </div>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <label>City
                      <input name="city" type="text" defaultValue={kycProfile?.city || ''} className="input" />
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>City or Municipality.</div>
                    </label>
                    <label>Province
                      <input name="province" type="text" defaultValue={kycProfile?.province || ''} className="input" />
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Province/Region.</div>
                    </label>
                    <label>Postal Code
                      <input name="postal_code" type="text" defaultValue={kycProfile?.postal_code || ''} className="input" />
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>ZIP/Postal code.</div>
                    </label>
                  </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <button className="btn" type="button" onClick={prev}>Back</button>
                  <button className="auth-btn" type="submit" disabled={kycSaving}>
                    {kycSaving ? 'Saving…' : 'Save & Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Documents */}
            {step === 3 && (
              <div>
                {loading ? (
                  <div>Loading KYC status…</div>
                ) : (
                  kyc?.status && <div style={{ marginBottom: 8 }}>KYC Status: <strong>{kyc.status}</strong></div>
                )}
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Documents</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Accepted: JPG, PNG, or PDF up to 5 MB. Upload front and back if applicable.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    Upload ID Front
                    <input type="file" data-type="id_front" onChange={uploadDoc} accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} />
                  </label>
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    Upload ID Back
                    <input type="file" data-type="id_back" onChange={uploadDoc} accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} />
                  </label>
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    Upload Supporting
                    <input type="file" data-type="supporting" onChange={uploadDoc} accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} />
                  </label>
                </div>
                {kycDocs?.length > 0 && (
                  <ul style={{ marginTop: 10 }}>
                    {kycDocs.map(doc => (
                      <li key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>
                        <span>{doc.type} — <span style={{ color: '#6b7280' }}>{doc.path}</span></span>
                        <button className="btn" onClick={() => deleteDoc(doc.id)}>Delete</button>
                      </li>
                    ))}
                  </ul>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
                  <button className="btn" type="button" onClick={prev}>Back</button>
                  <button className="auth-btn" type="button" onClick={finalizeApplication} disabled={submitting || !chosenTenantId}>
                    {submitting ? 'Submitting…' : 'Submit Application'}
                  </button>
                </div>
                {submitError && (
                  <div style={{ color: '#b42318', background: '#fee4e2', border: '1px solid #fda29b', padding: 10, borderRadius: 8, marginTop: 10 }}>{String(submitError)}</div>
                )}
                {submitOk && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginTop: 10 }}>
                    <div style={{ fontWeight: 600 }}>Application submitted.</div>
                    <div style={{ marginTop: 4 }}>We’ll email you once your application is reviewed.</div>
                  </div>
                )}
              </div>
            )}
        </Modal>
      )}

      {user && (role === 'contributor' || role === 'org_admin') && (
        <div className="card" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginTop: 16 }}>
          <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}><h2 className="card-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Your Organization</h2></div>
          <div className="card-body" style={{ padding: 16 }}>You are already a {role === 'org_admin' ? 'Organization Admin' : 'Contributor'}. Organization application is not needed.</div>
        </div>
      )}

      {user && role === 'superadmin' && (
        <div className="card" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginTop: 16 }}>
          <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}><h2 className="card-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Admin View</h2></div>
          <div className="card-body" style={{ padding: 16 }}>This page is meant for end users to complete KYC and apply to organizations. As a Superadmin, you can access reviews and decisions from the admin dashboard.</div>
        </div>
      )}
    </>
  );

  if (embedded) {
    // When embedded (MapPage), we only render the modal content and relevant notices
    return content;
  }

  return (
    <div className="content-page" style={{ backgroundColor: '#fff', color: '#111827' }}>
      {header}
      {content}
    </div>
  );
}
