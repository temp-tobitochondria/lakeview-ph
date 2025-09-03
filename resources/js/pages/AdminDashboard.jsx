import React from "react";
import { Route, Routes, NavLink } from "react-router-dom";
import {
  FaHome,
  FaBuilding,
  FaUsers,
  FaDatabase,
  FaMap,
  FaHistory,
  FaChartLine,
  FaCommentDots,
  FaCog,
  FaSignOutAlt,
  FaUser,
} from "react-icons/fa";

// Reusable page template
const Page = ({ title }) => (
  <div className="admin-content">
    <h2>{title}</h2>
  </div>
);

export default function AdminDashboard() {
  return (
    <div className="admin-dashboard-container">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div>
          <div className="admin-logo">
            <img src="/logo192.png" alt="LakeView Logo" />
            <span>LakeView PH</span>
          </div>
          <ul className="admin-nav-links">
            <li>
              <NavLink to="/admin-dashboard" end>
                <FaHome /> Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin-dashboard/organizations">
                <FaBuilding /> Manage Organizations
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin-dashboard/users">
                <FaUsers /> Manage Users
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin-dashboard/datasets">
                <FaDatabase /> Datasets
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin-dashboard/map-settings">
                <FaMap /> Map Settings
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin-dashboard/logs">
                <FaHistory /> Logs
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin-dashboard/analytics">
                <FaChartLine /> Analytics
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin-dashboard/feedback">
                <FaCommentDots /> Feedback
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin-dashboard/settings">
                <FaCog /> Settings
              </NavLink>
            </li>
          </ul>
        </div>

        <div className="admin-signout">
          <FaSignOutAlt /> Sign out
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main-content">
        {/* Topbar */}
        <div className="admin-topbar">
          <div className="admin-user-info">
            <FaUser /> Rodrigo Giongco ⌄
          </div>
        </div>

        {/* Page Content */}
        <Routes>
          <Route index element={<Page title="Dashboard" />} />
          <Route path="organizations" element={<Page title="Manage Organizations" />} />
          <Route path="users" element={<Page title="Manage Users" />} />
          <Route path="datasets" element={<Page title="Datasets" />} />
          <Route path="map-settings" element={<Page title="Map Settings" />} />
          <Route path="logs" element={<Page title="Logs" />} />
          <Route path="analytics" element={<Page title="Analytics" />} />
          <Route path="feedback" element={<Page title="Feedback" />} />
          <Route path="settings" element={<Page title="Settings" />} />
        </Routes>
      </main>
    </div>
  );
}
