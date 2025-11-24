// resources/js/layouts/DashboardLayout.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FiMap,
  FiLogOut,
  FiUser,
  FiChevronsLeft,
  FiChevronsRight,
  FiChevronLeft,
} from "react-icons/fi";
import { api, logout as apiLogout, clearToken, getToken, getUser, me as fetchMe } from "../lib/api";
import DashboardBoot from "../components/DashboardBoot"; // Overlay loader for dashboards
import { confirm, alertSuccess } from "../lib/alerts"; // ⬅️ SweetAlert2 helpers

export default function DashboardLayout({ links, user, children }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 768);
  const location = useLocation();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [isOverview, setIsOverview] = useState(false);

  // Fetch authenticated user once (dedup + cache via fetchMe helper)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!getToken()) return; // no token, skip
        // fetchMe() returns cached user if still fresh and dedups in-flight requests
        const u = await fetchMe({ maxAgeMs: 5 * 60 * 1000 });
        if (mounted) setMe(u || null);
      } catch {
        if (mounted) setMe(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Determine if current route is the overview route (exact link)
  useEffect(() => {
    const overviewLink = links.find(l => l.exact);
    setIsOverview(!!overviewLink && location.pathname === overviewLink.path);
  }, [location.pathname, links]);

  // Immediate readiness for non-overview routes (requirement 3)
  useEffect(() => {
    if (!isOverview) {
      try { window.dispatchEvent(new Event('lv-dashboard-ready')); } catch {}
    }
  }, [isOverview]);

  // Tightened fallback to ensure no lingering overlay (requirement 5)
  useEffect(() => {
    if (!isOverview) {
      const t = setTimeout(() => {
        try { window.dispatchEvent(new Event('lv-dashboard-ready')); } catch {}
      }, 200);
      return () => clearTimeout(t);
    }
  }, [location.pathname, isOverview]);

  // Find active link
  const activeLink = links.find(
    (l) => location.pathname === l.path || (l.exact && location.pathname === l.path)
  );

  // 🔔 SweetAlert2-powered signout
  async function handleSignOut() {
    const ok = await confirm(
      "Sign out?",
      "You will be logged out of LakeView PH.",
      "Yes, sign out"
    );
    if (!ok) return;

    try { await apiLogout(); } catch {}
    // Show success toast BEFORE navigation so it’s visible
    await alertSuccess("Signed out", "You have been signed out successfully.");
    navigate("/");
  }

  return (
    <div className="dashboard-container">
  {/* Dashboard boot overlay (session-first, delayed display) */}
  <DashboardBoot isOverview={isOverview} />
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${collapsed ? "collapsed" : ""}`}>
        <div>
          {/* Logo Row */}
          <div className="dashboard-logo">
            <img src="/lakeview-logo-alt.webp" alt="LakeView PH Logo" />
            <span className="dashboard-logo-text">LakeView PH</span>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setCollapsed(true)}
            aria-label="Close sidebar"
          >
            <FiChevronLeft size={24} />
          </button>

          {/* Navigation */}
          <ul className="dashboard-nav-links" role="navigation" aria-label="Dashboard">
            {links.map((link, i) => (
              <li key={i}>
                <NavLink to={link.path} end={link.exact || false} title={link.label} onClick={() => { if (window.innerWidth <= 768) setCollapsed(true); }}>
                  {link.icon}
                  <span className="link-text">{link.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* User Section */}
        <div className="dashboard-user-section">
          <div className="dashboard-user-info" title={me?.name || ""}>
            <FiUser size={18} />
            {me?.name ? <span className="user-name">{me.name}</span> : null}
          </div>
          <div
            className="dashboard-signout"
            role="button"
            tabIndex={0}
            onClick={handleSignOut}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSignOut()}
          >
            <FiLogOut size={18} /> <span className="signout-text">Sign out</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {activeLink && (
          <div className="dashboard-page-header">
            <div className="page-header-icon">{activeLink.icon}</div>
            <h1 className="page-header-title">{activeLink.label}</h1>
            <div className="page-header-actions">
              <NavLink
                className="btn-icon"
                onClick={() => setCollapsed((v) => !v)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? <FiChevronsRight size={18} /> : <FiChevronsLeft size={18} />}
              </NavLink>
              <NavLink to="/" className="btn-icon" title="View Public Map">
                <FiMap size={18} />
              </NavLink>
            </div>
          </div>
        )}
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}
