import React from 'react';
import StaffLoginForm from '../components/StaffLoginForm.jsx';
import { UserCheck } from 'lucide-react';

export default function FrontDeskLoginView() {
  return (
    <StaffLoginForm
      role="FRONT_DESK"
      portalLabel="FRONT DESK"
      title="Front Desk Login"
      subtitle="Access the Front Desk portal to register walk-in customers."
      Icon={UserCheck}
      accentColor="#7c3aed"
      defaultEmail="frontdesk@citycare.org"
      onOtherPortal={[
        { label: '🩺 Staff Console', view: 'login-staff' },
        { label: '⚙️ Org Admin', view: 'login-orgadmin' },
        { label: '👑 Super Admin', view: 'login-superadmin' },
        { label: '👤 Customer', view: 'login-customer' },
      ]}
    />
  );
}
