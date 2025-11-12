// resources/js/pages/AdminInterface/adminLogs.jsx
import React from 'react';
import AuditLogs from '../shared/AuditLogs';

// Thin wrapper preserving route/component identity for admin audit logs.
export default function AdminAuditLogsPage() {
	return <AuditLogs scope="admin" />;
}
