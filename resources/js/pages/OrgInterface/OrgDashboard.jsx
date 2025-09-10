// resources/js/pages/OrgInterface/OrgDashboard.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import {
  FiHome,
  FiUsers,
  FiPlusCircle,
  FiLayers,
  FiClipboard,
  FiFlag,
  FiSettings,
} from "react-icons/fi";

import DashboardLayout from "../../layouts/DashboardLayout";
import OrgOverview from "./orgOverview";
import OrgLogTest from "./orgLogTest";
import OrgMembers from "./orgMembers";
import OrgLayers from "./orgLayers";

const Page = ({ title }) => <h2>{title}</h2>;

export default function OrgDashboard() {
  const links = [
    { path: "/org-dashboard", label: "Overview", icon: <FiHome />, exact: true },
    { path: "/org-dashboard/members", label: "Members", icon: <FiUsers /> },
    { path: "/org-dashboard/log", label: "Log Test", icon: <FiPlusCircle /> },
    { path: "/org-dashboard/layers", label: "Layers", icon: <FiLayers /> },
    { path: "/org-dashboard/approvals", label: "Approvals", icon: <FiClipboard /> },
    { path: "/org-dashboard/alerts", label: "Alerts", icon: <FiFlag /> },
    { path: "/org-dashboard/settings", label: "Settings", icon: <FiSettings /> },
  ];

  const user = { name: "Org Manager" };

  return (
    <DashboardLayout links={links} user={user}>
      <Routes>
        <Route index element={<OrgOverview />} />
        <Route path="members" element={<OrgMembers />} />
        <Route path="log" element={<OrgLogTest />} />
        <Route path="layers" element={<OrgLayers />} />
        <Route path="approvals" element={<Page title="Approvals & Reviews" />} />
        <Route path="alerts" element={<Page title="Org Alerts" />} />
        <Route path="settings" element={<Page title="Settings" />} />
      </Routes>
    </DashboardLayout>
  );
}
