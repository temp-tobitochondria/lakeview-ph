import React, { useEffect } from 'react';
import Modal from '../Modal';
import { getCurrentUser } from '../../lib/authState';

// Storage keys
const LS_KEY = 'lv_welcome_choice'; // persistent user preference (remember)
const SS_KEY = 'lv_welcome_session_dismissed'; // session only dismissal
const COOLDOWN_HOURS = 24;

function loadPersistent() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return obj;
  } catch { return null; }
}
function savePersistent(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}
function markSessionDismissed() {
  try { sessionStorage.setItem(SS_KEY, '1'); } catch {}
}
function isSessionDismissed() {
  try { return sessionStorage.getItem(SS_KEY) === '1'; } catch { return false; }
}

// Decide if we should show the welcome modal given current conditions.
export function shouldShowWelcome({ user, pathname }) {
  // Must be unauthenticated
  if (user && user.id) return false;
  // Restrict to landing/root page for now
  if (pathname && pathname !== '/') return false;
  // Session dismissal check
  if (isSessionDismissed()) return false;
  // Persistent preference
  const pref = loadPersistent();
  if (pref?.remember && pref?.dismissed) return false;
  // Cooldown logic: if not remembered but recently dismissed (<24h) hide
  if (pref && pref.dismissed && pref.ts) {
    const ageHrs = (Date.now() - pref.ts) / 3600000;
    if (ageHrs < COOLDOWN_HOURS) return false;
  }
  return true;
}

export default function WelcomeModal({ open, onClose, onLogin }) {
  const user = getCurrentUser();

  const handleLogin = () => {
    // Persist dismissal (no remember option now)
    savePersistent({ dismissed: true, remember: false, ts: Date.now(), action: 'login' });
    markSessionDismissed();
    if (typeof onLogin === 'function') onLogin();
    if (typeof onClose === 'function') onClose();
  };

  const applyDismiss = (action = 'skip') => {
    savePersistent({ dismissed: true, remember: false, ts: Date.now(), action }); // store for cooldown
    markSessionDismissed();
  };

  const handleSkip = () => {
    applyDismiss('skip');
    if (typeof onClose === 'function') onClose();
  };

  const handleClose = () => {
    applyDismiss('close');
    if (typeof onClose === 'function') onClose();
  };

  const openPrivacy = (e) => {
    e.preventDefault();
    try { window.dispatchEvent(new Event('lv-open-privacy')); } catch {}
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={null}
      width={680}
      cardClassName="auth-card"
      bodyClassName="content-page modern-scrollbar"
      style={{ background:'rgba(17,24,39,0.75)', border:'1px solid #1f2937', borderRadius:18, padding:40, boxShadow:'0 8px 28px -6px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)' }}
    >
      <div style={{ display:'grid', gap:28, minHeight:400 }}>
        <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:18 }}>
          <img src="/lakeview-logo-alt.webp" alt="LakeView PH Logo" style={{ width:96, height:'auto', filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />
          <h1 style={{ margin:0, fontSize:36, fontWeight:700, color:'#fff', letterSpacing:0.3 }}>Welcome to LakeView PH</h1>
          <p style={{ margin:0, fontSize:16, lineHeight:1.6, color:'#ffffff', fontWeight:500, maxWidth:520, textAlign:'center' }}>
            LakeView PH provides interactive maps, lake data exploration, and tools for environmental collaboration. Browse public lake information, visualize population and water quality, and join organizations to contribute local insights.
          </p>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <button type="button" className="auth-btn" onClick={handleLogin} style={{ height:46, borderRadius:10, fontSize:15 }}>Log In / Register</button>
          <button type="button" onClick={handleSkip} style={{ height:46, borderRadius:10, fontSize:15, fontWeight:600, background:'#f1f5f9', color:'#1e293b', border:'1px solid #cbd5e1' }}>Continue as Guest</button>
        </div>

        <div style={{ fontSize:12, color:'#cbd5e1', textAlign:'center' }}>
          By continuing, you agree to our <a href="#data-policy" onClick={openPrivacy} style={{ color:'#60a5fa', textDecoration:'none', fontWeight:600 }}>Data Policy</a>.
        </div>
      </div>
    </Modal>
  );
}
