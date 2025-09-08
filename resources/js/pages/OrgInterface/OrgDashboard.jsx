// resources/js/pages/OrgInterface/OrgDashboard.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import {
  FiHome,
  FiUsers,
  FiDatabase,   // Samples list
  FiPlusCircle, // Log Sample
  FiUpload,
  FiClipboard,
  FiFlag,
  FiSettings,
} from "react-icons/fi";

import DashboardLayout from "../../layouts/DashboardLayout";
import OrgLogTest from "./orgLogTest";           // ⬅️ your wizard page
// Optional: a scaffold list component you can fill later
const SamplesList = () => <h2>Samples</h2>;

const Page = ({ title }) => <h2>{title}</h2>;

export default function OrgDashboard() {
  const links = [
    { path: "/org-dashboard", label: "Overview", icon: <FiHome />, exact: true },
    { path: "/org-dashboard/members", label: "Members", icon: <FiUsers /> },

    // ✅ Rename "Test Results" → "Samples"
    { path: "/org-dashboard/samples", label: "Samples", icon: <FiDatabase /> },

    // ✅ New quick entry for logging a sample
    { path: "/org-dashboard/samples/log", label: "Log Sample", icon: <FiPlusCircle /> },

    { path: "/org-dashboard/uploads", label: "Uploads", icon: <FiUpload /> },
    { path: "/org-dashboard/approvals", label: "Approvals", icon: <FiClipboard /> },
    { path: "/org-dashboard/alerts", label: "Alerts", icon: <FiFlag /> },
    { path: "/org-dashboard/settings", label: "Settings", icon: <FiSettings /> },
  ];

  const user = { name: "Org Manager" };

  return (
    <DashboardLayout links={links} user={user}>
      <Routes>
        <Route index element={<Page title="Org Dashboard" />} />
        <Route path="members" element={<Page title="Manage Members" />} />

        {/* ✅ Samples list (replaces old "test-results") */}
        <Route path="samples" element={<SamplesList />} />

        {/* ✅ Log Sample wizard */}
        <Route path="samples/log" element={<OrgLogTest />} />

        <Route path="uploads" element={<Page title="Manage Uploads" />} />
        <Route path="approvals" element={<Page title="Approvals & Reviews" />} />
        <Route path="alerts" element={<Page title="Org Alerts" />} />
        <Route path="settings" element={<Page title="Settings" />} />
      </Routes>
    </DashboardLayout>
  );
}
