import React, { useEffect, useState } from 'react';
import DashboardSettingsPanel from '../../components/settings/DashboardSettingsPanel';
import { getCurrentUser, setCurrentUser } from '../../lib/authState';
import api from '../../lib/api';
import { cachedGet } from '../../lib/httpCache';

export default function OrgSettingsPage() {
	const [user, setUser] = useState(() => getCurrentUser());
	useEffect(() => {
		if (!user) {
			(async () => {
				try { const res = await cachedGet('/auth/me', { ttlMs: 60 * 1000 }); const u = res?.data || res; if (u?.id) { setCurrentUser(u); setUser(u); } } catch {}
			})();
		}
		const onUpdate = (e) => setUser(e.detail);
		window.addEventListener('lv-user-update', onUpdate);
		return () => window.removeEventListener('lv-user-update', onUpdate);
	}, [user]);
	if (!user) return <div className="content-page"><p>Loading account…</p></div>;
	return <DashboardSettingsPanel />;
}
