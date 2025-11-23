import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../../../lib/api';
import { getCurrentUser } from '../../../lib/authState';

// localStorage key for acknowledged application statuses
const ACK_KEY = 'lv_app_ack';
// Any status change we want to notify for (now includes pending statuses too)
const NOTIFY_STATUS_SET = new Set(['pending_kyc','pending_org_review','approved','needs_changes','rejected']);

function loadAck() {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}
function saveAck(obj) {
  try { localStorage.setItem(ACK_KEY, JSON.stringify(obj)); } catch {}
}

export default function useOrgApplicationsBadge({ pollMs = 90000 } = {}) {
  const user = getCurrentUser();
  const isPublic = !!user?.id && (user.role === 'public' || !user.role);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const appsRef = useRef([]);
  const ackRef = useRef(loadAck());
  const timerRef = useRef(null);

    const compute = useCallback(() => { 
    const ack = ackRef.current;
    let c = 0;
    for (const app of appsRef.current) {
      const status = String(app?.status || '').toLowerCase();
      if (!NOTIFY_STATUS_SET.has(status)) continue;
      const key = String(app.id);
      if (ack[key] !== status) c += 1; // status changed or not acknowledged yet
    }
    setCount(c);
  }, []);

  const fetchApps = useCallback(async () => { 
    if (!isPublic) { setCount(0); return; }
    setLoading(true);
    try {
      // minimal + count (reuse same strategy as KycPage but simplified)
      const mine = await api.get('/org-applications/mine').catch(()=>null);
      const one = mine?.data || null;
      let list = [];
      if (one) list.push(one);
      // only call /mine/all if we can't determine status changes from single application (count endpoint could be added later if needed)
      const all = await api.get('/org-applications/mine/all').catch(()=>null);
      if (Array.isArray(all?.data)) list = all.data; // override with full list
      appsRef.current = Array.isArray(list) ? list : [];
      compute();
    } catch { /* silent */ } finally { setLoading(false); }
  }, [compute, isPublic]);

  const acknowledge = useCallback(() => { 
    const ack = ackRef.current;
    let changed = false;
    for (const app of appsRef.current) {
      const status = String(app?.status || '').toLowerCase();
      if (!NOTIFY_STATUS_SET.has(status)) continue;
      const key = String(app.id);
      if (ack[key] !== status) { ack[key] = status; changed = true; }
    }
    if (changed) { ackRef.current = { ...ack }; saveAck(ackRef.current); compute(); }
  }, [compute]);

  // Initial + poll
  // Adaptive polling: faster when window focused, slower when blurred
  useEffect(() => {
    let activeInterval = null;
    const startFast = () => {
      if (activeInterval) clearInterval(activeInterval);
      activeInterval = setInterval(fetchApps, Math.min(15000, pollMs));
    };
    const startSlow = () => {
      if (activeInterval) clearInterval(activeInterval);
      activeInterval = setInterval(fetchApps, pollMs);
    };
    fetchApps(); // initial load
    startSlow();
    const onFocus = () => { fetchApps(); startFast(); };
    const onBlur = () => { startSlow(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      if (activeInterval) clearInterval(activeInterval);
    };
  }, [fetchApps, pollMs]);

  // Listen for applications viewed event fired by KycPage
  useEffect(() => {
    const handlerViewed = () => acknowledge();
    const handlerRefresh = () => fetchApps();
    window.addEventListener('lv-applications-viewed', handlerViewed);
    window.addEventListener('lv-applications-refresh', handlerRefresh);
    window.addEventListener('lv-application-updated', handlerRefresh);
    return () => {
      window.removeEventListener('lv-applications-viewed', handlerViewed);
      window.removeEventListener('lv-applications-refresh', handlerRefresh);
      window.removeEventListener('lv-application-updated', handlerRefresh);
    };
  }, [acknowledge, fetchApps]);

  return { count, hasBadge: count > 0, loading, acknowledge };
}
