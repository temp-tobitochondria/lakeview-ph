

import React, { useEffect, useState } from "react";
import Modal from "./Modal";

export const TYPE_OPTIONS = [
  "LGU","Government Agency","LLDA","School/Academe","Research","NGO",
  "Community","Private","Utility","Other"
];

const empty = {
  name: "",
  type: "",
  contact_email: "",
  phone: "",
  address: "",
  active: true,
};

export default function OrganizationForm({ initialData = {}, onSubmit, open, onClose, title = "Organization" }) {
  const [form, setForm] = useState(empty);
  const isEdit = !!initialData?.id;

  useEffect(() => {
    const derivedActive = (initialData && Object.prototype.hasOwnProperty.call(initialData, 'is_active'))
      ? !!initialData.is_active
      : (typeof initialData?.active === 'boolean'
        ? initialData.active
        : (typeof initialData?.disabled === 'boolean' ? !initialData.disabled : true));
    setForm({
      ...empty,
      ...initialData,
      active: derivedActive,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id]);

  const disabled = !form.name?.trim();

  const handleChange = (key) => (e) => {
    const v = (e && e.target)
      ? (e.target.type === "checkbox" ? e.target.checked : e.target.value)
      : e;
    setForm((s) => ({ ...s, [key]: v }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const payload = {
      name: form.name?.trim(),
      type: form.type || null,
      contact_email: form.contact_email || null,
      phone: form.phone || null,
      address: form.address || null,
      active: !!form.active,
    };
    onSubmit?.(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} width={640} ariaLabel="Organization form">
      <form onSubmit={handleSubmit} style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        maxWidth: 600,
        margin: '0 auto',
      }}>
        <label className="lv-field" style={{ gridColumn: '1/2' }}>
          <span>Name*</span>
          <input type="text" value={form.name} onChange={handleChange("name")}
            required placeholder="Organization name" />
        </label>

        <label className="lv-field" style={{ gridColumn: '2/3' }}>
          <span>Type</span>
          <select value={form.type || ""} onChange={handleChange("type")}> 
            <option value="">— Select —</option>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="lv-field" style={{ gridColumn: '1/2' }}>
          <span>Contact Email</span>
          <input type="email" value={form.contact_email || ""} onChange={handleChange("contact_email")}
            placeholder="contact@email.com" />
        </label>

        <label className="lv-field" style={{ gridColumn: '2/3' }}>
          <span>Phone</span>
          <input type="text" value={form.phone || ""} onChange={handleChange("phone")}
            placeholder="" />
        </label>

        <label className="lv-field" style={{ gridColumn: '1/3' }}>
          <span>Address</span>
          <input type="text" value={form.address || ""} onChange={handleChange("address")}
            placeholder="" />
        </label>

        <label className="lv-field" style={{ gridColumn: '1/2' }}>
          <span>Status *</span>
          <select
            value={form.active ? 'active' : 'inactive'}
            onChange={(e) => setForm(s => ({ ...s, active: e.target.value === 'active' }))}
            required
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <div style={{ gridColumn: '1/3', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="submit" className="pill-btn primary" disabled={disabled}>{isEdit ? "Save Changes" : "Create"}</button>
        </div>
      </form>
    </Modal>
  );
}
