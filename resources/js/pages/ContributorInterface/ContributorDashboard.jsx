// resources/js/pages/ContributorInterface/ContributorDashboard.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import {
  FiHome,          // Overview
  FiMap,           // Lakes
  FiLayers,        // My Layers
  FiUploadCloud,   // Uploads
  FiClipboard,     // Submissions
  FiDroplet,       // Test Results / Sampling
  FiBell,          // Notifications
  FiActivity,      // Activity
  FiUser,          // Profile
  FiSettings,      // Settings
  FiLifeBuoy,      // Help
} from "react-icons/fi";

import DashboardLayout from "../../layouts/DashboardLayout";

const Page = ({ title }) => <h2>{title}</h2>;

export default function ContributorDashboard() {
  const links = [
    // Overview (KPI Dashboard)
    { path: "/contrib-dashboard", label: "Overview", icon: <FiHome />, exact: true },

    // Water Bodies
    { path: "/contrib-dashboard/lakes", label: "Water Bodies", icon: <FiMap /> },

    // Data & layers owned by contributor
    { path: "/contrib-dashboard/my-layers", label: "My Layers", icon: <FiLayers /> },

    // Upload wizard / ingestion (limited scope)
    { path: "/contrib-dashboard/uploads", label: "Uploads", icon: <FiUploadCloud /> },

    // Test results (sampling forms, drafts)
    { path: "/contrib-dashboard/test-results", label: "Test Results", icon: <FiDroplet /> },

    // Submissions (pending/approved/rejected)
    { path: "/contrib-dashboard/submissions", label: "Submissions", icon: <FiClipboard /> },

    // Notifications
    { path: "/contrib-dashboard/notifications", label: "Notifications", icon: <FiBell /> },

    // Activity (own actions/audit-lite)
    { path: "/contrib-dashboard/activity", label: "Activity", icon: <FiActivity /> },

    // Profile & Settings
    { path: "/contrib-dashboard/profile", label: "Profile", icon: <FiUser /> },
    { path: "/contrib-dashboard/settings", label: "Settings", icon: <FiSettings /> },

    // Help/Docs
    { path: "/contrib-dashboard/help", label: "Help", icon: <FiLifeBuoy /> },
  ];

  return (
    <DashboardLayout
      links={links}
    >
      <Routes>
        {/* Overview */}
        <Route index element={<Page title="Overview" />} />

        {/* Water Bodies */}
        <Route path="lakes" element={<Page title="Water Bodies" />} />

        {/* My Layers */}
        <Route path="my-layers" element={<Page title="My Layers" />} />

        {/* Uploads */}
        <Route path="uploads" element={<Page title="Uploads" />} />

        {/* Test Results */}
        <Route path="test-results" element={<Page title="Test Results" />} />

        {/* Submissions */}
        <Route path="submissions" element={<Page title="Submissions" />} />

        {/* Notifications */}
        <Route path="notifications" element={<Page title="Notifications" />} />

        {/* Activity */}
        <Route path="activity" element={<Page title="Activity" />} />

        {/* Profile & Settings */}
        <Route path="profile" element={<Page title="Profile" />} />
        <Route path="settings" element={<Page title="Settings" />} />

        {/* Help */}
        <Route path="help" element={<Page title="Help" />} />
      </Routes>
    </DashboardLayout>
  );
}
