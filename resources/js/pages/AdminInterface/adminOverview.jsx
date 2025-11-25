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
    return (
      <Link to={to} className="kpi-card-link" style={{ textDecoration: 'none', color: 'inherit' }}>
        {cardInner}
      </Link>
    );
  }

  return cardInner;
}

export default function AdminOverview() {
  const [kpis, setKpis] = useState({
    orgs: { value: null, loading: true, error: null },
    users: { value: null, loading: true, error: null },
    lakes: { value: null, loading: true, error: null },
    events: { value: null, loading: true, error: null },
  });
  // Track if we've signaled dashboard readiness
  const [readySignaled, setReadySignaled] = useState(false);

  const publish = useCallback((id, payload) => {
    setKpis((prev) => ({ ...prev, [id]: payload }));
    window.dispatchEvent(new CustomEvent('lv:kpi:update', { detail: { id, ...payload } }));
  }, []);

  const fetchAll = useCallback(async () => {
    publish('orgs', { loading: true });
    publish('users', { loading: true });
    publish('lakes', { loading: true });
    publish('events', { loading: true });

    const compositeKey = 'admin:kpis:summary:v2';
    const cached = kpiCache.getKpi(compositeKey);
    if (cached) {
      for (const k of ['orgs','users','lakes','events']) {
        if (cached[k] != null) publish(k, { value: cached[k], loading: false });
      }
    }
    try {
      const res = await api.get('/kpis');
      const data = res?.data?.data || res?.data || res; // support various wrappers
      const admin = data?.admin || {};
      const payload = {
        orgs: admin?.orgs?.count ?? null,
        users: admin?.users?.count ?? null,
        lakes: admin?.lakes?.count ?? null,
        events: admin?.events?.count ?? null,
      };
      kpiCache.setKpi(compositeKey, payload, 60 * 1000);
      for (const k of Object.keys(payload)) {
        if (payload[k] != null) publish(k, { value: payload[k], loading: false });
      }
      if (!readySignaled) { window.dispatchEvent(new Event('lv-dashboard-ready')); setReadySignaled(true); }
      return; // success - stop
    } catch (e) {
    }

    try {
      const res = await api.get('/admin/kpis/summary');
      const d = res?.data?.data || res?.data || res;
      const payload = {
        orgs: d?.orgs?.count ?? null,
        users: d?.users?.count ?? null,
        lakes: d?.lakes?.count ?? null,
        events: d?.events?.count ?? d?.tests?.count ?? null,
      };
      kpiCache.setKpi(compositeKey, payload, 60 * 1000);
      for (const k of Object.keys(payload)) {
        if (payload[k] != null) publish(k, { value: payload[k], loading: false });
      }
      if (!readySignaled) { window.dispatchEvent(new Event('lv-dashboard-ready')); setReadySignaled(true); }
      return;
    } catch (e) { /* continue */ }

    try {
      const [orgRes, userRes, lakeRes, evRes] = await Promise.all([
        api.get('/admin/kpis/orgs'),
        api.get('/admin/kpis/users'),
        api.get('/admin/kpis/lakes'),
        api.get('/admin/kpis/tests'),
      ]);
      const payload = {
        orgs: orgRes?.data?.count ?? null,
        users: userRes?.data?.count ?? null,
        lakes: lakeRes?.data?.count ?? null,
        events: evRes?.data?.count ?? null,
      };
      kpiCache.setKpi(compositeKey, payload, 60 * 1000);
      for (const k of Object.keys(payload)) {
        if (payload[k] != null) publish(k, { value: payload[k], loading: false });
      }
      if (!readySignaled) { window.dispatchEvent(new Event('lv-dashboard-ready')); setReadySignaled(true); }
    } catch (e) {
      for (const k of ['orgs','users','lakes','events']) publish(k, { value: null, loading: false, error: true });
      if (!readySignaled) { window.dispatchEvent(new Event('lv-dashboard-ready')); setReadySignaled(true); }
    }
  }, [publish, readySignaled]);

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
