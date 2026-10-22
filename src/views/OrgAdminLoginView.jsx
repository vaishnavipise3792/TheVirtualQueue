import React from 'react';
import StaffLoginForm from '../components/StaffLoginForm.jsx';
import { Brain } from 'lucide-react';

export default function OrgAdminLoginView() {
  return (
    <StaffLoginForm
      role="ORG_ADMIN"
      portalLabel="ORG ADMIN & AI STUDIO"
      title="Organization Admin Login"
      subtitle="Access Admin & AI Studio to manage services, analytics, and your Random Forest model."
      Icon={Brain}
      accentColor="#6d28d9"
      defaultEmail="admin@citycare.org"
      onOtherPortal={[
        { label: '🩺 Staff Console', view: 'login-staff' },
        { label: '📋 Front Desk', view: 'login-frontdesk' },
        { label: '👑 Super Admin', view: 'login-superadmin' },
        { label: '👤 Customer', view: 'login-customer' },
      ]}
    />
  );
}
