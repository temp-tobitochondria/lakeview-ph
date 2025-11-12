// resources/js/pages/OrgInterface/orgLogs.jsx
import React from 'react';
import AuditLogs from '../shared/AuditLogs';

// Thin wrapper preserving route/component identity for org audit logs.
export default function OrgAuditLogsPage() {
  return <AuditLogs scope="org" />;
}
