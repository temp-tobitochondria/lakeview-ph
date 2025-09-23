import React, { useEffect, useState } from "react";
import api from "../lib/api";
import Modal from "./Modal";

export default function OrganizationManageModal({ org, open, onClose }) {
	const [activeTab, setActiveTab] = useState("members");
	const [members, setMembers] = useState([]);
	const [admins, setAdmins] = useState([]);
	const [unassigned, setUnassigned] = useState([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (open && org) fetchTabs();
		// eslint-disable-next-line
	}, [open, org]);

	const fetchTabs = async () => {
		setLoading(true);
		try {
			const [membersRes, adminsRes, unassignedRes] = await Promise.all([
				api.get(`/admin/tenants/${org.id}/members`).catch(() => ({ data: [] })),
				api.get(`/admin/tenants/${org.id}/admins`).catch(() => ({ data: [] })),
				api.get(`/admin/users`, { params: { tenant_id: null } }).catch(() => ({ data: [] })),
			]);
			setMembers(membersRes.data || []);
			setAdmins(adminsRes.data || []);
			setUnassigned(unassignedRes.data || []);
		} catch (e) {
			// fallback: show nothing
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal open={open} onClose={onClose} title={`Manage Organization: ${org?.name || ""}`} width={700}>
			<div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
				<button className={activeTab === "members" ? "tab-active" : "tab"} onClick={() => setActiveTab("members")}>Members</button>
				<button className={activeTab === "admins" ? "tab-active" : "tab"} onClick={() => setActiveTab("admins")}>Org Admins</button>
				<button className={activeTab === "unassigned" ? "tab-active" : "tab"} onClick={() => setActiveTab("unassigned")}>Unassigned Users</button>
			</div>
			<div style={{ minHeight: 300 }}>
				{loading ? (
					<div>Loading…</div>
				) : activeTab === "members" ? (
					<div>
						<h4>Organization Members</h4>
						<ul>
							{members.map((m) => (
								<li key={m.id}>{m.name} ({m.email})</li>
							))}
						</ul>
					</div>
				) : activeTab === "admins" ? (
					<div>
						<h4>Organization Admins</h4>
						<ul>
							{admins.map((a) => (
								<li key={a.id}>{a.name} ({a.email})</li>
							))}
						</ul>
					</div>
				) : (
					<div>
						<h4>Unassigned Users</h4>
						<ul>
							{unassigned.map((u) => (
								<li key={u.id}>{u.name} ({u.email})</li>
							))}
						</ul>
					</div>
				)}
			</div>
			<div style={{ marginTop: 24, textAlign: "right" }}>
				<button className="pill-btn ghost" onClick={onClose}>Close</button>
			</div>
		</Modal>
	);
}
