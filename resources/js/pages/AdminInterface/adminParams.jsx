// resources/js/pages/AdminInterface/adminParams.jsx
import React, { useMemo, useState } from "react";
import {
  FiFilter,
  FiPlus,
  FiSave,
  FiSearch,
  FiSliders,
  FiTrash2,
  FiEdit2,
} from "react-icons/fi";

import TableLayout from "../../layouts/TableLayout";

/**
 * AdminParameters
 * - Minimal MVP for creating parameters (global catalog)
 * - No backend yet: handlers show where to plug API calls
 * - Empty initial state (no mock rows)
 *
 * Parameter fields:
 * - code (e.g., DO, BOD5)
 * - name (e.g., Dissolved Oxygen)
 * - category (e.g., Physico-chemical, Nutrients, Metals, Microbiological, Biological)
 * - unit (e.g., mg/L, µg/L, NTU, °C, "pH units")
 * - description (optional)
 */
export default function AdminParameters() {
  /* ------------------------------ Form state ------------------------------ */
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "",
    unit: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  /* ------------------------------ List state ------------------------------ */
  const [params, setParams] = useState([]);           // ← start empty
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  /* ------------------------------ Derived list ---------------------------- */
  const filtered = useMemo(() => {
    let list = params;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.code?.toLowerCase().includes(q) ||
          p.name?.toLowerCase().includes(q) ||
          p.unit?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      list = list.filter((p) => p.category === categoryFilter);
    }
    return list;
  }, [params, query, categoryFilter]);

  /* ------------------------------ Columns -------------------------------- */
  const columns = useMemo(
    () => [
      { header: "Code", accessor: "code", width: 120 },
      { header: "Name", accessor: "name" },
      { header: "Category", accessor: "category", width: 190 },
      { header: "Unit", accessor: "unit", width: 120 },
      {
        header: "Description",
        accessor: "description",
        render: (row) => row.description || "—",
      },
    ],
    []
  );

  const actions = useMemo(
    () => [
      {
        label: "Edit",
        type: "edit",
        icon: <FiEdit2 />,
        onClick: (row) => {
          // Load into form for editing
          setForm({ ...row, __editingId: row.id });
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      },
      {
        label: "Delete",
        type: "delete",
        icon: <FiTrash2 />,
        onClick: (row) => {
          // TODO: confirm, then call DELETE /api/parameters/:id
          setParams((prev) => prev.filter((p) => p.id !== row.id));
        },
      },
    ],
    []
  );

  /* ------------------------------ Handlers -------------------------------- */
  const resetForm = () =>
    setForm({ code: "", name: "", category: "", unit: "", description: "" });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.unit.trim() || !form.category.trim()) {
      alert("Please complete Code, Name, Unit, and Category.");
      return;
    }

    setSaving(true);
    try {
      // TODO: replace with POST/PATCH to your API.
      // If __editingId exists → PATCH; otherwise → POST.

      if (form.__editingId) {
        setParams((prev) =>
          prev.map((p) => (p.id === form.__editingId ? { ...p, ...form } : p))
        );
      } else {
        setParams((prev) => [
          ...prev,
          { id: crypto.randomUUID(), ...form },
        ]);
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  /* ------------------------------ UI ------------------------------------- */
  return (
    <div className="dashboard-card">
      {/* Header */}
      <div className="dashboard-card-header">
        <div className="dashboard-card-title">
          <FiSliders />
          <span>Parameters</span>
        </div>
      </div>

      {/* Create/Edit form */}
      <form onSubmit={handleSave} className="dashboard-card-body">
        <div className="org-form">
          <div className="form-group">
            <label>Code *</label>
            <input
              type="text"
              placeholder="e.g., DO, BOD5, pH"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ minWidth: 280 }}>
            <label>Name *</label>
            <input
              type="text"
              placeholder="e.g., Dissolved Oxygen"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Category *</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">Select category</option>
              <option>Physico-chemical</option>
              <option>Nutrients</option>
              <option>Metals</option>
              <option>Microbiological</option>
              <option>Biological</option>
            </select>
          </div>

          <div className="form-group">
            <label>Unit *</label>
            <input
              type="text"
              placeholder='e.g., mg/L, "pH units", NTU, °C'
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ flexBasis: "100%" }}>
            <label>Description</label>
            <input
              type="text"
              placeholder="Optional short description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button type="submit" className="pill-btn primary" disabled={saving}>
            <FiSave />
            <span className="hide-sm">{form.__editingId ? "Update" : "Save Parameter"}</span>
          </button>
          {form.__editingId ? (
            <button type="button" className="pill-btn" onClick={handleCancelEdit}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {/* Toolbar (search & filter) */}
      <div className="dashboard-card-header" style={{ marginTop: 16 }}>
        <div className="org-toolbar" style={{ gridTemplateColumns: "1fr auto auto" }}>
          <div className="org-search" style={{ minWidth: 0 }}>
            <FiSearch className="toolbar-icon" />
            <input
              type="text"
              placeholder="Search code, name, unit, category…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="org-filter">
            <FiFilter className="toolbar-icon" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              <option>Physico-chemical</option>
              <option>Nutrients</option>
              <option>Metals</option>
              <option>Microbiological</option>
              <option>Biological</option>
            </select>
          </div>

          <div className="org-actions-right">
            <button type="button" className="pill-btn" onClick={() => resetForm()}>
              <FiPlus />
              <span className="hide-sm">New</span>
            </button>
          </div>
        </div>
      </div>

      {/* Parameters table */}
      <div className="dashboard-card-body" style={{ paddingTop: 8 }}>
        <div className="table-wrapper">
          <TableLayout
            columns={columns}
            data={filtered}
            pageSize={10}
            actions={actions}
          />
        </div>
      </div>
    </div>
  );
}
