// resources/js/pages/ContributorInterface/contribWQTests.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import TableLayout from "../../layouts/TableLayout";
import TableToolbar from "../../components/table/TableToolbar";
import FilterPanel from "../../components/table/FilterPanel";
import OrgWQTestModal from "../../components/water-quality-test/OrgWQTestModal";
import { FiEye, FiEdit2, FiTrash2, FiDroplet } from "react-icons/fi";
import DashboardHeader from "../../components/DashboardHeader";

import { api } from "../../lib/api";
import { cachedGet, invalidateHttpCache } from "../../lib/httpCache";
import { fetchLakeOptions } from "../../lib/layers";
import { alertSuccess, alertError, alertWarning, confirm as swalConfirm } from "../../lib/alerts";

function startOfDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}
function yqmFrom(record) {
  const d = record?.sampled_at ? new Date(record.sampled_at) : null;
  const y = Number(record?.year ?? (d ? d.getFullYear() : NaN));
  const m = Number(record?.month ?? (d ? d.getMonth() + 1 : NaN));
  const q = Number(record?.quarter ?? (Number.isFinite(m) ? Math.floor((m - 1) / 3) + 1 : NaN));
  return { year: y, quarter: q, month: m };
}

export default function ContribWQTests() {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const location = useLocation();
  const qp = new URLSearchParams(location.search);

  const [lakes, setLakes] = useState([]);
  const [tests, setTests] = useState([]);
  const [members, setMembers] = useState([]);
  const [membersFetchForbidden, setMembersFetchForbidden] = useState(false);
  const [paramCatalog, setParamCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  // dynamic Y/Q/M options
  const [yearOpts, setYearOpts] = useState([]);
  const [quarterOpts, setQuarterOpts] = useState([]);
  const [monthOpts, setMonthOpts] = useState([]);

  // filters/search
  const [q, setQ] = useState("");
  const [lakeId, setLakeId] = useState("");
  const [status, setStatus] = useState(() => qp.get('status') || '');
  const [memberId, setMemberId] = useState(() => qp.get('member_id') || qp.get('created_by_user_id') || '');
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [year, setYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [month, setMonth] = useState("");

  // If created_by_user_id is provided in the query params, apply a client-side filter later
  const createdByUserIdFromQs = qp.get('created_by_user_id') || qp.get('user_id') || null;
  const memberIdFromQs = qp.get('member_id') || qp.get('created_by_user_id') || null;

  // modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);

  const [resetSignal, setResetSignal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await cachedGet("/auth/me", { ttlMs: 60 * 1000 });
        if (!mounted) return;
        setCurrentUserId(me?.id ?? null);
        const org = me?.organization || (me?.tenant ? me.tenant : null);
        if (org?.id) setCurrentOrgId(org.id);
        else if (me?.organization_id) setCurrentOrgId(me.organization_id);
        else if (me?.tenant_id) setCurrentOrgId(me.tenant_id);
      } catch (e) {
        if (mounted) {
          setCurrentUserId(null);
          setCurrentOrgId(null);
        }
      } finally {
        if (mounted) setAuthLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // fetch members (org_admin + contributor) once org context resolved
  useEffect(() => {
    let mounted = true;
    if (!authLoaded) return () => {};
    if (!currentOrgId) return () => {};
    (async () => {
      try {
        const r = await cachedGet(`/org/${currentOrgId}/users`, { ttlMs: 5 * 60 * 1000 });
        if (!mounted) return;
        const raw = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
        const filtered = (Array.isArray(raw) ? raw : []).filter((u) => {
          if (!u) return false;
          const roleStr = (u.role || '').toString();
          if (['org_admin', 'contributor'].includes(roleStr)) return true;
          const rid = Number(u.role_id);
          if (!Number.isNaN(rid) && [2,3].includes(rid)) return true;
          return false;
        });
        setMembers(filtered);
        setMembersFetchForbidden(false);
      } catch (e) {
        // If the API forbids listing users for this contributor, fall back to building
        // a members list from tests we've already fetched (created_by fields).
        console.warn('[ContribWQTests] failed to fetch members', e);
        const status = e?.response?.status || (e?.message ? (e.message.includes('Forbidden') ? 403 : null) : null);
        if (status === 403) {
          setMembersFetchForbidden(true);
        }
      }
    })();
    return () => { mounted = false; };
  }, [authLoaded, currentOrgId]);

  // If listing org users is forbidden for this contributor role, construct a members list
  // from existing tests' created_by fields so the member filter still works.
  useEffect(() => {
    if (!membersFetchForbidden) return;
    // derive unique users from tests
    const map = new Map();
    tests.forEach((t) => {
      const id = t.created_by_user_id ?? t.createdBy?.id ?? t.created_by;
      const name = t.createdBy?.name || t.created_by_name || t.created_by_display || t.sampler_name || null;
      if (id && !map.has(String(id))) {
        map.set(String(id), { id: String(id), name: name || `User ${id}` });
      }
    });
    // do not add a placeholder for the current user here
    setMembers(Array.from(map.values()));
  }, [membersFetchForbidden, tests, currentUserId]);

  useEffect(() => {
    let mounted = true;
    let timer = null;
    timer = setTimeout(() => {
      (async () => {
        try {
          const opts = await fetchLakeOptions();
          if (!mounted) return;
          setLakes(Array.isArray(opts) ? opts : []);
        } catch (e) {
          console.error('[ContribWQTests] failed to fetch lakes', e);
          if (mounted) setLakes([]);
        }
      })();

      (async () => {
        try {
          const params = await api('/options/parameters');
          if (!mounted) return;
          setParamCatalog(Array.isArray(params) ? params : []);
        } catch (e) {
          if (mounted) setParamCatalog([]);
        }
      })();
      // member fetching moved to dedicated effect when org context is resolved
    }, 50);
    return () => { mounted = false; if (timer) clearTimeout(timer); };
  }, []);

  // fetch tests for this contributor's organization (server-side pagination)
  useEffect(() => {
    let mounted = true;
    if (!authLoaded) return () => {};
    if (!currentOrgId) return () => {};
    setLoading(true);
    (async () => {
      try {
        const basePath = `/contrib/${currentOrgId}/sample-events`;
        const params = new URLSearchParams();
        params.set('per_page', '10');
        params.set('page', String(page));
    if (lakeId) params.set('lake_id', String(lakeId));
    if (status) params.set('status', String(status));
    if (memberId) params.set('created_by_user_id', String(memberId));
    if (year) params.set('year', String(year));
    if (quarter) params.set('quarter', String(quarter));
    if (month) params.set('month', String(month));
    if (q) params.set('q', String(q));
        const deriveRange = () => {
          if (dateFrom || dateTo) return { from: dateFrom || null, to: dateTo || null };
          const y = year ? Number(year) : null;
          const qv = quarter ? Number(quarter) : null;
          const m = month ? Number(month) : null;
          if (!y) return { from: null, to: null };
          if (m) { const start = new Date(y, m - 1, 1); const end = new Date(y, m, 0); return { from: start.toISOString(), to: end.toISOString() }; }
          if (qv) { const sm = (qv - 1) * 3; const start = new Date(y, sm, 1); const end = new Date(y, sm + 3, 0); return { from: start.toISOString(), to: end.toISOString() }; }
          const start = new Date(y, 0, 1); const end = new Date(y, 12, 0); return { from: start.toISOString(), to: end.toISOString() };
        };
        const range = deriveRange();
        if (range.from) params.set('sampled_from', range.from);
        if (range.to) params.set('sampled_to', range.to);

  const res = await cachedGet(`${basePath}?${params.toString()}`, { ttlMs: 2 * 60 * 1000 });
        if (!mounted) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : (Array.isArray(res?.data?.data) ? res.data.data : []);
        setTests(list);
        const cp = res?.current_page ?? 1; const lp = res?.last_page ?? 1;
        setTotalPages(Number(lp) || 1);
        if (Number(cp) > Number(lp)) {
          setPage(Number(lp) || 1);
        } else if (Number(cp) !== Number(page)) {
          setPage(Number(cp) || 1);
        }
      } catch (e) {
        console.error('[ContribWQTests] failed to fetch tests', e);
        if (mounted) { setTests([]); setTotalPages(1); if (page !== 1) setPage(1); }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [authLoaded, currentOrgId, resetSignal, page, lakeId, status, memberId, dateFrom, dateTo, year, quarter, month, q]);

  // Reset to first page whenever filters/search change to avoid empty pages after narrowing
  useEffect(() => {
    if (!authLoaded || !currentOrgId) return;
    setPage(1);
  }, [authLoaded, currentOrgId, lakeId, status, memberId, dateFrom, dateTo, year, quarter, month, q]);

  const doRefresh = async () => {
    setLoading(true);
    try {
  const eventsPath = currentOrgId ? `/contrib/${currentOrgId}/sample-events` : null;
      if (!currentOrgId) return;
      const params = new URLSearchParams();
      params.set('per_page', '10');
      params.set('page', '1');
      if (lakeId) params.set('lake_id', String(lakeId));
      if (status) params.set('status', String(status));
      if (memberId) params.set('created_by_user_id', String(memberId));
      if (year) params.set('year', String(year));
      if (quarter) params.set('quarter', String(quarter));
      if (month) params.set('month', String(month));
      if (q) params.set('q', String(q));
      const deriveRange = () => {
        if (dateFrom || dateTo) return { from: dateFrom || null, to: dateTo || null };
        const y = year ? Number(year) : null;
        const qv = quarter ? Number(quarter) : null;
        const m = month ? Number(month) : null;
        if (!y) return { from: null, to: null };
        if (m) { const start = new Date(y, m - 1, 1); const end = new Date(y, m, 0); return { from: start.toISOString(), to: end.toISOString() }; }
        if (qv) { const sm = (qv - 1) * 3; const start = new Date(y, sm, 1); const end = new Date(y, sm + 3, 0); return { from: start.toISOString(), to: end.toISOString() }; }
        const start = new Date(y, 0, 1); const end = new Date(y, 12, 0); return { from: start.toISOString(), to: end.toISOString() };
      };
      const range = deriveRange();
      if (range.from) params.set('sampled_from', range.from);
      if (range.to) params.set('sampled_to', range.to);

      const [testsRes, lakesOpts, paramsRes] = await Promise.allSettled([
        cachedGet(`/contrib/${currentOrgId}/sample-events?${params.toString()}`, { ttlMs: 2 * 60 * 1000 }),
        fetchLakeOptions(),
        cachedGet('/options/parameters', { ttlMs: 20 * 60 * 1000 }),
      ]);

      if (testsRes.status === 'fulfilled') {
        const data = Array.isArray(testsRes.value.data) ? testsRes.value.data : [];
        let filtered;
        if (currentOrgId) {
          const orgId = currentOrgId;
          filtered = data.filter((t) => (
            (t.organization_id && String(t.organization_id) === String(orgId)) ||
            (t.tenant_id && String(t.tenant_id) === String(orgId)) ||
            (t.organization && t.organization.id && String(t.organization.id) === String(orgId)) ||
            (t.tenant && t.tenant.id && String(t.tenant.id) === String(orgId))
          ));
        } else {
          filtered = data;
        }
        setTests(filtered);
      }
      if (lakesOpts.status === 'fulfilled') {
        setLakes(Array.isArray(lakesOpts.value) ? lakesOpts.value : []);
      }
      if (paramsRes.status === 'fulfilled') {
        setParamCatalog(Array.isArray(paramsRes.value) ? paramsRes.value : []);
      }
  setResetSignal((x) => x + 1);
  setPage(1);
    } catch (e) {
      console.error('[ContribWQTests] refresh failed', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch dynamic options for Year/Quarter/Month
  useEffect(() => {
    let mounted = true;
    if (!authLoaded) return () => {};
    if (!currentOrgId) return () => {};
    (async () => {
      try {
        const params = new URLSearchParams();
        if (lakeId) params.set('lake_id', String(lakeId));
        if (status) params.set('status', String(status));
        if (memberId) params.set('created_by_user_id', String(memberId));
        if (dateFrom) params.set('sampled_from', dateFrom);
        if (dateTo) params.set('sampled_to', dateTo);
        if (year) params.set('year', String(year));
        if (quarter) params.set('quarter', String(quarter));
        if (q) params.set('q', String(q));
        const res = await cachedGet(`/contrib/${currentOrgId}/sample-events/options?${params.toString()}`, { ttlMs: 60 * 1000 });
        if (!mounted) return;
        const data = res?.data ?? res;
        setYearOpts(Array.isArray(data?.years) ? data.years : []);
        setQuarterOpts(Array.isArray(data?.quarters) ? data.quarters : []);
        setMonthOpts(Array.isArray(data?.months) ? data.months : []);
      } catch (e) {
        if (mounted) { setYearOpts([]); setQuarterOpts([]); setMonthOpts([]); }
      }
    })();
    return () => { mounted = false; };
  }, [authLoaded, currentOrgId, lakeId, status, memberId, dateFrom, dateTo, year, quarter, q]);

  const baseColumns = useMemo(
    () => [
      { id: "year", header: "Year", width: 90, render: (row) => yqmFrom(row).year ?? "—", sortValue: (row) => yqmFrom(row).year ?? null },
      { id: "quarter", header: "Quarter", width: 90, render: (row) => { const q = yqmFrom(row).quarter; return Number.isFinite(q) ? `Q${q}` : "—"; }, sortValue: (row) => yqmFrom(row).quarter ?? null },
      { id: "month_day", header: "Month-Day", width: 160, render: (row) => { if (!row || !row.sampled_at) return "—"; try { const d = new Date(row.sampled_at); return d.toLocaleDateString(undefined, { month: "long", day: "numeric" }); } catch (e) { return "—"; } }, sortValue: (row) => (row?.sampled_at ? new Date(row.sampled_at) : null) },
      { id: "lake_name", header: "Lake", width: 200, render: (row) => row?.lake?.name ?? row?.lake_name ?? "—", sortValue: (row) => row?.lake?.name ?? row?.lake_name ?? "" },
      { id: "station_name", header: "Station", width: 220, render: (row) => { const name = row?.station?.name ?? row?.station_name; if (name) return name; if (row?.latitude != null && row?.longitude != null) { try { const lat = Number(row.latitude).toFixed(6); const lon = Number(row.longitude).toFixed(6); return `${lat}, ${lon}`; } catch (e) { return "—"; } } return "—"; }, sortValue: (row) => row?.station?.name ?? row?.station_name ?? (row?.latitude != null && row?.longitude != null ? `${row.latitude},${row.longitude}` : "") },
      { id: "status", header: "Status", width: 120, render: (row) => (<span className={`tag ${row.status === "public" ? "success" : "muted"}`}>{row.status === "public" ? "Published" : "Draft"}</span>), sortValue: (row) => (row.status === "public" ? 1 : 0) },
      { id: "logged_by", header: "Logged By", width: 180, render: (row) => (row?.createdBy?.name ?? row?.created_by_name ?? "—"), sortValue: (row) => row?.createdBy?.name ?? row?.created_by_name ?? "" },
      { id: "updated_by", header: "Updated By", width: 180, render: (row) => (row?.updatedBy?.name ?? row?.updated_by_name ?? "—"), sortValue: (row) => row?.updatedBy?.name ?? row?.updated_by_name ?? "" },
      { id: "logged_at", header: "Logged At", width: 170, render: (row) => (row?.created_at ? new Date(row.created_at).toLocaleString() : "—"), sortValue: (row) => (row?.created_at ? new Date(row.created_at) : null) },
      { id: "updated_at", header: "Updated At", width: 170, render: (row) => (row?.updated_at ? new Date(row.updated_at).toLocaleString() : "—"), sortValue: (row) => (row?.updated_at ? new Date(row.updated_at) : null) },
    ],
    []
  );

  const [visibleMap, setVisibleMap] = useState(() => Object.fromEntries(baseColumns.map((c) => [c.id, !["logged_by","updated_by","logged_at","updated_at"].includes(c.id)])));
  const displayColumns = useMemo(() => baseColumns.filter((c) => visibleMap[c.id] !== false), [baseColumns, visibleMap]);

  const filtered = useMemo(() => {
    let from = dateFrom ? startOfDay(dateFrom) : null;
    let to = dateTo ? endOfDay(dateTo) : null;
    if (from && to && from > to) { const tmp = from; from = to; to = tmp; }
    return tests.filter((t) => {
      if (lakeId && String(t.lake_id) !== String(lakeId)) return false;
      if (status && String(t.status) !== status) return false;
      // Apply optional created_by_user_id or member filter from query string / UI
      if (typeof createdByUserIdFromQs !== 'undefined' && createdByUserIdFromQs && String(t.created_by_user_id) !== String(createdByUserIdFromQs)) return false;
      if (memberId && String((t.created_by_user_id ?? t.createdBy?.id ?? t.created_by) || '') !== String(memberId)) return false;
      const yqm = yqmFrom(t);
      if (year && String(yqm.year) !== String(year)) return false;
      if (quarter && String(yqm.quarter) !== String(quarter)) return false;
      if (month && String(yqm.month) !== String(month)) return false;
      if (from || to) {
        const d = new Date(t.sampled_at);
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      // Note: free-text search is handled server-side via the `q` parameter
      return true;
    });
  }, [tests, lakeId, status, memberId, year, quarter, month, dateFrom, dateTo]);

  const actions = [
    {
      label: "View",
      title: "View",
      icon: <FiEye />,
      onClick: (row) => { setSelected(row); setEditing(false); setOpen(true); },
    },
    {
      label: "Edit",
      title: "Edit",
      icon: <FiEdit2 />,
      visible: (row) => Boolean(currentUserId && String(row.created_by_user_id) === String(currentUserId)),
      onClick: async (row) => { setSelected(row); setEditing(true); setOpen(true); },
    },
    {
      label: "Delete",
      title: "Delete",
      type: "delete",
      icon: <FiTrash2 />,
      visible: (row) => Boolean(currentUserId && String(row.created_by_user_id) === String(currentUserId)),
      onClick: async (row) => {
        const ok = await swalConfirm({ title: 'Delete this test?', text: `This cannot be undone.`, icon: 'warning', confirmButtonText: 'Delete' });
        if (!ok) return;
        try {
          if (!currentOrgId) return;
          const basePath = `/contrib/${currentOrgId}/sample-events`;
          await api(`${basePath}/${row.id}`, { method: "DELETE" });
          try { invalidateHttpCache(basePath); } catch {}
          setTests((prev) => prev.filter((t) => t.id !== row.id));
          await alertSuccess('Deleted', 'The test was removed.');
        } catch (e) {
          await alertError('Delete failed', e?.message || 'Please try again.');
        }
      },
    },
  ];

  const monthName = (m) => [null,'January','February','March','April','May','June','July','August','September','October','November','December'][m] || String(m);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const toolbarNode = (
    <TableToolbar
      tableId="contrib-wqtests"
      search={{ value: q, onChange: setQ, placeholder: "ID, station, sampler, method…" }}
      filters={[]}
      columnPicker={{ columns: baseColumns.map((c) => ({ id: c.id, label: c.header })), visibleMap, onVisibleChange: (next) => setVisibleMap(next) }}
      onResetWidths={() => setResetSignal((x) => x + 1)}
      onRefresh={doRefresh}
      onToggleFilters={() => setFiltersOpen((v) => !v)}
  filtersBadgeCount={[lakeId, status, memberId, year, quarter, month, dateFrom, dateTo].filter(Boolean).length}
      onExport={null}
      onAdd={null}
    />
  );

  const filterFields = [
    { id: 'lake', label: 'Lake', type: 'select', value: lakeId, onChange: setLakeId, options: [{ value: '', label: 'All lakes' }, ...lakes.map((l) => ({ value: String(l.id), label: l.name }))] },
    { id: 'status', label: 'Status', type: 'select', value: status, onChange: setStatus, options: [{ value: '', label: 'All' }, { value: 'draft', label: 'Draft' }, { value: 'public', label: 'Published' }] },
    { id: 'member', label: 'Member', type: 'select', value: memberId, onChange: setMemberId, options: [{ value: '', label: 'Any Member' }, ...members.map((m) => ({ value: String(m.id), label: m.name || m.full_name || m.display_name || m.email || `User ${m.id}` }))] },
    {
      id: 'yqm',
      type: 'group',
      children: [
  { id: 'year', label: 'Year', type: 'select', value: year, onChange: setYear, options: [{ value: '', label: 'Year' }, ...yearOpts.map((yy) => ({ value: String(yy), label: String(yy) }))] },
        { id: 'quarter', label: 'Quarter', type: 'select', value: quarter, onChange: setQuarter, options: [{ value: '', label: 'Quarter' }, ...quarterOpts.map((qv) => ({ value: String(qv), label: `Q${qv}` }))] },
        { id: 'month', label: 'Month', type: 'select', value: month, onChange: setMonth, options: [{ value: '', label: 'Month' }, ...monthOpts.map((mv) => ({ value: String(mv), label: monthName(mv) }))] },
      ],
    },
    { id: 'from', label: 'From', type: 'date', value: dateFrom, onChange: setDateFrom },
    { id: 'to', label: 'To', type: 'date', value: dateTo, onChange: setDateTo },
  ];

  const clearAllFilters = () => { setLakeId(''); setStatus(''); setMemberId(''); setYear(''); setQuarter(''); setMonth(''); setDateFrom(''); setDateTo(''); };

  return (
    <div className="dashboard-content">
      <DashboardHeader
        icon={<FiDroplet />}
        title="Water Quality Tests"
        description="Browse, filter, and manage water quality test records for your organization."
      />
      <div className="dashboard-card-body">
        {toolbarNode}
        <FilterPanel open={filtersOpen} fields={filterFields} onClearAll={clearAllFilters} />
        <TableLayout
          tableId="contrib-wqtests"
          columns={displayColumns}
          data={filtered}
          actions={actions}
          resetSignal={resetSignal}
          columnPicker={false}
          loading={loading}
          loadingLabel={loading ? 'Loading tests…' : null}
          serverSide={true}
          pagination={{ page, totalPages }}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      <OrgWQTestModal
        open={open}
        onClose={() => setOpen(false)}
        record={selected}
        editable={editing}
        parameterCatalog={paramCatalog}
        canPublish={false}
        basePath={currentOrgId ? `/contrib/${currentOrgId}/sample-events` : '/admin/sample-events'}
        onSave={async (updated) => {
          setTests((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
          setSelected(updated);
          await alertSuccess('Saved', 'Sampling event updated successfully.');
        }}
      />
    </div>
  );
}
