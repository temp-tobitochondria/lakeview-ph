// resources/js/components/DashboardBoot.jsx
import React, { useEffect, useState } from 'react';

/*
  DashboardBoot overlay
  - Shows an overlay spinner while initial dashboard data (e.g., KPIs/auth) is loading.
  - Hidden when any component dispatches the custom event 'lv-dashboard-ready'.
  - Also auto hides after a safety timeout (4.5s) to avoid being stuck.
  - Uses a minimal inline style set to avoid blocking on CSS file loads.
  - Accessible: role="status" aria-live polite and reduced motion friendly.
*/
export default function DashboardBoot({ isOverview = false }) {
  // Always eligible on each dashboard mount (show on normal refresh too)
  const eligible = true;
  // Delay showing to avoid flashing for fast loads
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let done = false;

    // Delayed display: only show overlay if still not ready after 250ms
    const showTimer = setTimeout(() => {
      setShouldRender(true);
    }, 250);

    function hide() {
      if (done) return; // idempotent
      done = true;
      setVisible(false);
    }
    const onReady = () => hide();
    window.addEventListener('lv-dashboard-ready', onReady);
    // Failsafe timeout (tightened per requirement 5)
    const t = setTimeout(hide, 2000);
    return () => {
      window.removeEventListener('lv-dashboard-ready', onReady);
      clearTimeout(t);
      clearTimeout(showTimer);
    };
  }, []);

  // Skip entirely if overlay not eligible
  if (!eligible) return null;
  // If hidden or not yet past delay threshold, render nothing
  if (!visible || !shouldRender) return null;

  return (
    <div
      id="lv-dashboard-boot"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', inset: 0, background: '#0b1220', color: '#e5e7eb',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 9998, transition: 'opacity .25s ease', fontFamily: 'system-ui, sans-serif'
      }}
    >
      <img
        src="/lakeview-logo-alt.webp"
        alt="LakeView PH"
        style={{ width: 64, height: 64, objectFit: 'contain', filter: 'drop-shadow(0 2px 12px rgba(37,99,235,0.45))', marginBottom: 18 }}
      />
      <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '.3px', marginBottom: 12 }}>Loading dashboard…</div>
      <div
        aria-hidden="true"
        style={{
          width: 28, height: 28, border: '3px solid rgba(255,255,255,.18)', borderTopColor: '#2563eb',
          borderRadius: '50%', animation: 'lvdashspin .9s linear infinite'
        }}
      />
      {/* Keyframe style injection (scoped) */}
      <style>{`@keyframes lvdashspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
