import React, { useEffect, useState } from "react";
import Modal from "./Modal";

const EMPTY = {
  code: "",
  name: "",
  unit: "",
  evaluation_type: "",
  desc: "",
};

export default function ParameterForm({
  open,
  mode = "create",               // "create" | "edit"
  initialValue = EMPTY,
  unitOptions = [],
  loading = false,
  onSubmit,                        // (formObject) => void
  onCancel,
}) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    const normalized = { ...EMPTY, ...(initialValue || {}) };
    setForm(normalized);
  }, [initialValue, open]);

  const submit = async (e) => {
    e?.preventDefault?.();
    const payload = {
      code: String(form.code || "").trim(),
      name: String(form.name || "").trim(),
      unit: form.unit || null,
      evaluation_type: form.evaluation_type || null,
      desc: (form.desc || "").trim() || null,
    };
    if (!payload.code || !payload.name) return; // minimal guard
    return onSubmit?.(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={mode === "create" ? "Add Water Quality Parameter" : `Edit parameter: ${form.code}`}
      ariaLabel="Parameter Form"
      width={720}
      footer={
        <div className="lv-modal-actions">
          <button type="button" className="pill-btn ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="pill-btn primary" form="lv-parameter-form" disabled={loading}>
            {loading ? "Saving..." : mode === "create" ? "Create" : "Save Changes"}
          </button>
        </div>
      }
    >
      <form id="lv-parameter-form" onSubmit={submit} className="lv-grid-2">
        <label className="lv-field">
          <span>Code *</span>
          <input
            required
            placeholder="e.g. DO"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            disabled={mode === 'edit'}
          />
        </label>

        <label className="lv-field">
          <span>Name *</span>
          <input
            required
            placeholder="Dissolved Oxygen"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        <label className="lv-field">
          <span>Unit</span>
          <select
            value={form.unit || ""}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          >
            <option value="">Select unit</option>
            {unitOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="lv-field">
          <span>Evaluation</span>
          <select
            value={form.evaluation_type || ""}
            onChange={(e) => setForm({ ...form, evaluation_type: e.target.value })}
          >
            <option value="">Not set</option>
            <option value="Max (≤)">Max (≤)</option>
            <option value="Min (≥)">Min (≥)</option>
            <option value="Range">Range (between)</option>
          </select>
        </label>

        <label className="lv-field" style={{ gridColumn: '1 / span 2' }}>
          <span>Description</span>
          <input
            placeholder="Add description"
            value={form.desc || ""}
            onChange={(e) => setForm({ ...form, desc: e.target.value })}
          />
        </label>
      </form>
    </Modal>
  );
}
