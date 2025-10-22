import React, { useState, useEffect } from "react";
import Modal from "../Modal";
import { alertError, alertSuccess, alertWarning } from "../../lib/alerts";

const VISIBILITY_LABELS = {
  public: "Public",
  admin: "Admin",
  organization: "Admin (legacy)",
  organization_admin: "Admin (legacy)",
};

const getVisibilityLabel = (value) => VISIBILITY_LABELS[value] || value || "Unknown";

export default function LayerEditModal({
  open,
  onClose,
  layer,
  currentUserRole,
  normalizedVisibilityOptions = [],
  allLayers = [],
  onSave
}) {
  const [formData, setFormData] = useState({
    name: "",
    notes: "",
    visibility: "public",
    is_active: false,
    is_downloadable: false,
  });

  useEffect(() => {
    if (layer && open) {
      const initialEditVisibility = (() => {
        const current = ['organization', 'organization_admin'].includes(layer.visibility) ? 'admin' : layer.visibility;
        if (normalizedVisibilityOptions.some((opt) => opt.value === current)) return current;
        return normalizedVisibilityOptions[0]?.value || 'public';
      })();

      setFormData({
        name: layer.name || '',
        notes: layer.notes || '',
        visibility: initialEditVisibility,
        is_active: !!layer.is_active,
        is_downloadable: !!layer.is_downloadable,
      });
    }
  }, [layer, open, normalizedVisibilityOptions]);

  const handleSubmit = async () => {
    try {
      // If user is trying to enable default (changing from false to true), ensure no other layer is default
      if (formData.is_active && !layer.is_active) {
        const existing = allLayers.find((l) => l.is_active && l.id !== layer.id);
        if (existing) {
          await alertWarning('Default Layer Exists', `"${existing.name}" is already set as the default layer.\n\nPlease unset it first or turn off default for this layer.`);
          return;
        }
      }

      // Only superadmin may change visibility or default flag per backend; org_admin limited to name/category/notes.
      const patch = {
        name: formData.name,
        notes: formData.notes || null,
      };
      if (currentUserRole === 'superadmin') {
        patch.visibility = formData.visibility;
        patch.is_active = !!formData.is_active;
        patch.is_downloadable = !!formData.is_downloadable;
      } else {
        // org_admin path: backend allows is_downloadable modification, include if changed
        patch.is_downloadable = !!formData.is_downloadable;
      }

      await onSave(layer.id, patch);
      onClose();
      await alertSuccess('Layer updated', 'Changes saved successfully.');
    } catch (e) {
      console.error('[LayerEditModal] Update layer failed', e);
      await alertError('Failed to update layer', e?.message || '');
    }
  };

  if (!layer) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Layer Metadata"
      width={640}
      ariaLabel="Edit Layer"
      footer={
        <div className="lv-modal-actions">
          <button className="pill-btn ghost" onClick={onClose}>Cancel</button>
          <button className="pill-btn primary" onClick={handleSubmit}>
            Save Changes
          </button>
        </div>
      }
    >
      <div className="org-form">
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="form-group" style={{ flexBasis: '100%' }}>
          <label>Notes</label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Short description / source credits"
          />
        </div>
        {currentUserRole === 'superadmin' && (
          <>
            <div className="form-group">
              <label>Visibility</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData((f) => ({ ...f, visibility: e.target.value }))}
              >
                {[...normalizedVisibilityOptions,
                  ...(layer && layer.visibility && !normalizedVisibilityOptions.some((opt) => opt.value === layer.visibility)
                    ? [{ value: layer.visibility, label: getVisibilityLabel(layer.visibility) }]
                    : []
                  )].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label>Default Layer</label>
              <select
                value={formData.is_active ? 'yes' : 'no'}
                onChange={(e) => setFormData((f) => ({ ...f, is_active: e.target.value === 'yes' }))}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="form-group">
              <label>Downloadable</label>
              <select
                value={formData.is_downloadable ? 'yes' : 'no'}
                onChange={(e) => setFormData((f) => ({ ...f, is_downloadable: e.target.value === 'yes' }))}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </>
        )}
        {currentUserRole === 'org_admin' && (
          <div className="form-group">
            <label>Downloadable</label>
            <select
              value={formData.is_downloadable ? 'yes' : 'no'}
              onChange={(e) => setFormData((f) => ({ ...f, is_downloadable: e.target.value === 'yes' }))}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}