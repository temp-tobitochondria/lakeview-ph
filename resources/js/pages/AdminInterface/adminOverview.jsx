// resources/js/pages/AdminInterface/AdminOverview.jsx
import React, { useMemo, useEffect, useState, useCallback } from "react";
import { Link } from 'react-router-dom';
import {
  FiBriefcase,    // Organizations
  FiUsers,        // Registered Users
  FiMap,          // Lakes in Database
  FiDroplet,      // Water Quality Reports in Database
} from "react-icons/fi";

import api from "../../lib/api";
import kpiCache from '../../lib/kpiCache';
import DashboardHeader from '../../components/DashboardHeader';
import { FiHome } from 'react-icons/fi';

/* KPI Grid */
function KPIGrid() {
  // Local state lifted into parent via hooks in AdminOverview; here we just render placeholders
  return (
    <div className="kpi-grid">
      <KpiCard id="orgs" icon={<FiBriefcase />} title="Organizations" to="/admin-dashboard/organizations" />
      <KpiCard id="users" icon={<FiUsers />} title="Registered Users" to="/admin-dashboard/users" />
      <KpiCard id="lakes" icon={<FiMap />} title="Lakes" to="/admin-dashboard/lakes" />
      <KpiCard id="events" icon={<FiDroplet />} title="Water Quality Reports" to="/admin-dashboard/wq-tests" />
    </div>
  );
}

function KpiCard({ id, icon, title, to }) {
  // We'll read values from the DOM-level shared store via a simple event-based approach
  // The AdminOverview component will dispatch a custom event with payload { id, value, loading, error }
  const [state, setState] = useState({ value: null, loading: true, error: null });

  useEffect(() => {
    const handler = (e) => {
      if (!e?.detail) return;
      if (e.detail.id !== id) return;
      setState({ value: e.detail.value, loading: !!e.detail.loading, error: e.detail.error || null });
    };
    window.addEventListener('lv:kpi:update', handler);
    return () => window.removeEventListener('lv:kpi:update', handler);
  }, [id]);

  const display = state.loading ? '…' : (state.error ? '—' : (state.value ?? '0'));

  const cardInner = (
    <div className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-info">
        <div className="kpi-title-wrap">
          <span className="kpi-title btn-link">{title}</span>
        </div>
        <span className="kpi-value">{display}</span>
      </div>
    </div>
  );

  if (to) {
    // Wrap the whole card in a Link so the entire card is clickable.
    return (
      <Link to={to} className="kpi-card-link" style={{ textDecoration: 'none', color: 'inherit' }}>
        {cardInner}
      </Link>
    );
  }

  return cardInner;
}

/* ============================================================
   Overview Map
   (Basemap only; no markers/features preloaded.)
   ============================================================ */
/* ============================================================
   Page: AdminOverview
   ============================================================ */
export default function AdminOverview() {
  const [kpis, setKpis] = useState({
    orgs: { value: null, loading: true, error: null },
    users: { value: null, loading: true, error: null },
    lakes: { value: null, loading: true, error: null },
    events: { value: null, loading: true, error: null },
  });

  const publish = useCallback((id, payload) => {
    setKpis((prev) => ({ ...prev, [id]: payload }));
    window.dispatchEvent(new CustomEvent('lv:kpi:update', { detail: { id, ...payload } }));
  }, []);

  const fetchAll = useCallback(async () => {
    // Mark all as loading (UI stays stable if cached values appear immediately below)
    publish('orgs', { loading: true });
    publish('users', { loading: true });
    publish('lakes', { loading: true });
    publish('events', { loading: true });

    // 1) Try consolidated summary endpoint with composite cache
    const compositeKey = 'admin:kpis:summary';
    const compositeCached = kpiCache.getKpi(compositeKey);
    if (compositeCached && typeof compositeCached === 'object') {
      const { orgs, users, lakes, events } = compositeCached;
      if (orgs != null) publish('orgs', { value: orgs, loading: false });
      if (users != null) publish('users', { value: users, loading: false });
      if (lakes != null) publish('lakes', { value: lakes, loading: false });
      if (events != null) publish('events', { value: events, loading: false });
    }

    try {
      const res = await api.get('/admin/kpis/summary');
      const data = res?.data || res; // tolerate either wrappers
      const payload = {
        orgs: data?.orgs?.count ?? data?.data?.orgs?.count ?? null,
        users: data?.users?.count ?? data?.data?.users?.count ?? null,
        lakes: data?.lakes?.count ?? data?.data?.lakes?.count ?? null,
        events: data?.events?.count ?? data?.data?.events?.count ?? null,
      };
      // Update cache and UI
      kpiCache.setKpi(compositeKey, payload, 60 * 1000);
      if (payload.orgs != null) publish('orgs', { value: payload.orgs, loading: false });
      if (payload.users != null) publish('users', { value: payload.users, loading: false });
      if (payload.lakes != null) publish('lakes', { value: payload.lakes, loading: false });
      if (payload.events != null) publish('events', { value: payload.events, loading: false });
      return;
    } catch (e) {
      // Fall back to parallel legacy endpoints
    }

    try {
      const [orgRes, userRes, lakeRes, evRes] = await Promise.all([
        api.get('/admin/kpis/orgs'),
        api.get('/admin/kpis/users'),
        api.get('/admin/kpis/lakes'),
        api.get('/admin/kpis/tests'),
      ]);
      const orgTotal = orgRes?.data?.count ?? orgRes?.count ?? null;
      const userTotal = userRes?.data?.count ?? userRes?.count ?? null;
      const lakeTotal = lakeRes?.data?.count ?? lakeRes?.count ?? null;
      const evTotal = evRes?.data?.count ?? evRes?.count ?? null;
      const payload = { orgs: orgTotal, users: userTotal, lakes: lakeTotal, events: evTotal };
      kpiCache.setKpi(compositeKey, payload, 60 * 1000);
      publish('orgs', { value: orgTotal, loading: false });
      publish('users', { value: userTotal, loading: false });
      publish('lakes', { value: lakeTotal, loading: false });
      publish('events', { value: evTotal, loading: false });
    } catch (e) {
      publish('orgs', { value: null, loading: false, error: true });
      publish('users', { value: null, loading: false, error: true });
      publish('lakes', { value: null, loading: false, error: true });
      publish('events', { value: null, loading: false, error: true });
    }
  }, [publish]);

  useEffect(() => {
    fetchAll();
    const onRefresh = () => fetchAll();
    window.addEventListener('lv:kpi:refresh', onRefresh);
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return; // pause when tab hidden
      fetchAll();
    }, 60 * 1000); // refresh every minute (paused when hidden)
    return () => { window.removeEventListener('lv:kpi:refresh', onRefresh); clearInterval(interval); };
  }, [fetchAll]);

  return (
    <>
      <DashboardHeader
        icon={<FiHome />}
        title="Overview"
        description="Quick operational metrics and recent platform KPIs for administrators."
      />
      <KPIGrid />
    </>
  );
}
