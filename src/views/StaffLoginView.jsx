import React from 'react';
import StaffLoginForm from '../components/StaffLoginForm.jsx';
import { MonitorCheck } from 'lucide-react';

export default function StaffLoginView() {
  return (
    <StaffLoginForm
      role="STAFF"
      portalLabel="STAFF CONSOLE"
      title="Staff Login"
      subtitle="Access the Staff Console to manage patient and customer queues."
      Icon={MonitorCheck}
      accentColor="#7c3aed"
      defaultEmail="dr.mehta@citycare.org"
      onOtherPortal={[
        { label: '📋 Front Desk', view: 'login-frontdesk' },
        { label: '⚙️ Org Admin', view: 'login-orgadmin' },
        { label: '👑 Super Admin', view: 'login-superadmin' },
        { label: '👤 Customer', view: 'login-customer' },
      ]}
    />
  );
}
