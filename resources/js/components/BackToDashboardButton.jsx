import React from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

// Role-aware back button extracted from MapPage
export default function BackToDashboardButton({ role }) {
  const navigate = useNavigate();
  if (!role) return null;
  const onClick = () => {
    if (role === 'superadmin') navigate('/admin-dashboard');
    else if (role === 'org_admin') navigate('/org-dashboard');
    else if (role === 'contributor') navigate('/contrib-dashboard');
  };
  return (
    <button
      className="map-back-btn"
      onClick={onClick}
      title="Back to Dashboard"
      style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1100, display: 'inline-flex' }}
    >
      <FiArrowLeft />
    </button>
  );
}
