import React from 'react';
import StaffLoginForm from '../components/StaffLoginForm.jsx';
import { ShieldCheck } from 'lucide-react';

export default function SuperAdminLoginView() {
  return (
    <StaffLoginForm
      role="SUPER_ADMIN"
      portalLabel="SUPER ADMIN"
      title="Super Admin Login"
      subtitle="Platform-wide management for organizations, queues, and system configuration."
      Icon={ShieldCheck}
      accentColor="#581c87"
      defaultEmail="superadmin@queueless.io"
      onOtherPortal={[
        { label: '⚙️ Org Admin', view: 'login-orgadmin' },
        { label: '🩺 Staff Console', view: 'login-staff' },
        { label: '📋 Front Desk', view: 'login-frontdesk' },
        { label: '👤 Customer', view: 'login-customer' },
      ]}
    />
  );
}
