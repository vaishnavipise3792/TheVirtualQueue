import { db, initSchema, getKolkataDate, getUtcIso } from './db.js';
import { joinQueue } from './queueEngine.js';
import { trainModel } from './waitTimeService.js';

export function seedDatabase() {
  initSchema();

  // Clear existing demo data to ensure a fresh clean state
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM notifications;
    DELETE FROM queue_entries;
    DELETE FROM service_sequences;
    DELETE FROM service_counters;
    DELETE FROM counters;
    DELETE FROM services;
    DELETE FROM branches;
    DELETE FROM staff_users;
    DELETE FROM organizations;
  `);

  console.log('Seeding organizations...');
  const now = getUtcIso();
  const dateKolkata = getKolkataDate();

  // 1. HOSPITAL: City Care Multispeciality Hospital
  const hospitalId = 'org_hospital_01';
  db.prepare(`
    INSERT INTO organizations (id, name, type, description, created_at)
    VALUES (?, ?, 'HOSPITAL', ?, ?)
  `).run(
    hospitalId,
    'City Care Multispeciality Hospital',
    'Tertiary care hospital with 24x7 OPD, diagnostic imaging, and pharmacy services',
    now
  );

  const hospBranchId = 'br_hospital_main';
  db.prepare(`
    INSERT INTO branches (id, organization_id, name, address, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(hospBranchId, hospitalId, 'Main Campus - Central OPD Block', 'Plot 42, Health City, Ring Road', now);

  const hospServices = [
    {
      id: 'srv_cardio',
      name: 'Cardiology OPD',
      code: 'CAR',
      grace: 5,
      threshold: 2,
      avgMins: 12.0,
      priorities: [
        { key: 'EMERGENCY', label: 'Emergency / Acute Chest Pain', weight: 100 },
        { key: 'SENIOR', label: 'Senior Citizen (65+)', weight: 50 },
        { key: 'NORMAL', label: 'General Consultation', weight: 10 }
      ],
      optionalFields: [
        {
          key: 'reason',
          label: 'Reason for Visit',
          type: 'select',
          options: ['Routine Checkup', 'Chest Pain / Angina', 'Follow-up ECG / Echo', 'Prescription Renewal'],
          required: false
        },
        {
          key: 'referral_doctor',
          label: 'Referring Physician (Optional)',
          type: 'text',
          required: false
        }
      ]
    },
    {
      id: 'srv_ortho',
      name: 'Orthopaedics & Joint Care',
      code: 'ORT',
      grace: 5,
      threshold: 2,
      avgMins: 10.0,
      priorities: [
        { key: 'EMERGENCY', label: 'Acute Fracture / Trauma', weight: 100 },
        { key: 'SENIOR', label: 'Senior Citizen', weight: 50 },
        { key: 'NORMAL', label: 'Normal OPD', weight: 10 }
      ],
      optionalFields: [
        {
          key: 'injury_type',
          label: 'Type of Joint / Bone Issue',
          type: 'select',
          options: ['Knee / Hip Pain', 'Spine / Backache', 'Sports Injury', 'Post-Op Follow-up'],
          required: false
        }
      ]
    },
    {
      id: 'srv_pharmacy',
      name: 'Central OPD Pharmacy',
      code: 'PHA',
      grace: 3,
      threshold: 3,
      avgMins: 4.5,
      priorities: [
        { key: 'SENIOR', label: 'Senior Citizen', weight: 50 },
        { key: 'NORMAL', label: 'General Dispensing', weight: 10 }
      ],
      optionalFields: [
        {
          key: 'prescription_id',
          label: 'Prescription Slip #',
          type: 'text',
          required: false
        }
      ]
    }
  ];

  for (const s of hospServices) {
    db.prepare(`
      INSERT INTO services (
        id, organization_id, branch_id, name, code, grace_period_mins,
        notification_threshold, avg_service_mins, priority_levels_json, optional_fields_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      s.id, hospitalId, hospBranchId, s.name, s.code, s.grace,
      s.threshold, s.avgMins, JSON.stringify(s.priorities), JSON.stringify(s.optionalFields), now
    );
  }

  const hospCounters = [
    { id: 'cnt_hosp_1', name: 'Room 101 - Dr. Mehta (Cardio)' },
    { id: 'cnt_hosp_2', name: 'Room 102 - Dr. Roy (Cardio)' },
    { id: 'cnt_hosp_3', name: 'Room 205 - Dr. Ananya (Ortho)' },
    { id: 'cnt_hosp_4', name: 'Counter A - Pharmacy Dispense' }
  ];

  for (const c of hospCounters) {
    db.prepare(`
      INSERT INTO counters (id, organization_id, branch_id, name, current_staff_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(c.id, hospitalId, hospBranchId, c.name, 'Active Staff', now);
  }

  // Link services to counters
  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_cardio', 'cnt_hosp_1')`).run();
  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_cardio', 'cnt_hosp_2')`).run();
  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_ortho', 'cnt_hosp_3')`).run();
  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_pharmacy', 'cnt_hosp_4')`).run();

  // 2. BANK: Apex National Bank
  const bankId = 'org_bank_02';
  db.prepare(`
    INSERT INTO organizations (id, name, type, description, created_at)
    VALUES (?, ?, 'BANK', ?, ?)
  `).run(
    bankId,
    'Apex National Bank',
    'Premier retail and commercial banking branch with express teller counters',
    now
  );

  const bankBranchId = 'br_bank_main';
  db.prepare(`
    INSERT INTO branches (id, organization_id, name, address, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(bankBranchId, bankId, 'Downtown Corporate Branch', '100 Financial Boulevard, Floor 1', now);

  const bankServices = [
    {
      id: 'srv_cash',
      name: 'Cash Deposit & Withdrawal',
      code: 'DEP',
      grace: 4,
      threshold: 2,
      avgMins: 5.0,
      priorities: [
        { key: 'PREMIUM', label: 'Apex Wealth / Priority Banking', weight: 100 },
        { key: 'SENIOR', label: 'Senior Citizen & Specially Abled', weight: 50 },
        { key: 'NORMAL', label: 'Standard Customer', weight: 10 }
      ],
      optionalFields: [
        {
          key: 'account_type',
          label: 'Account Type',
          type: 'select',
          options: ['Savings Account', 'Current / Business Account', 'Overdraft (OD)', 'NRI Account'],
          required: false
        },
        {
          key: 'cash_bracket',
          label: 'Transaction Amount Bracket',
          type: 'select',
          options: ['Under ₹50,000', '₹50,000 - ₹2,00,000', 'Above ₹2,00,000 (Form 60/PAN)'],
          required: false
        }
      ]
    },
    {
      id: 'srv_loan',
      name: 'Retail Loans & Mortgages',
      code: 'LON',
      grace: 6,
      threshold: 1,
      avgMins: 15.0,
      priorities: [
        { key: 'PREMIUM', label: 'Priority Customer', weight: 100 },
        { key: 'NORMAL', label: 'Standard Loan Enquiry', weight: 10 }
      ],
      optionalFields: [
        {
          key: 'loan_product',
          label: 'Loan Product',
          type: 'select',
          options: ['Home Loan', 'Auto / Vehicle Loan', 'Personal Loan', 'MSME Business Loan'],
          required: false
        }
      ]
    }
  ];

  for (const s of bankServices) {
    db.prepare(`
      INSERT INTO services (
        id, organization_id, branch_id, name, code, grace_period_mins,
        notification_threshold, avg_service_mins, priority_levels_json, optional_fields_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      s.id, bankId, bankBranchId, s.name, s.code, s.grace,
      s.threshold, s.avgMins, JSON.stringify(s.priorities), JSON.stringify(s.optionalFields), now
    );
  }

  const bankCounters = [
    { id: 'cnt_bank_1', name: 'Teller Counter 1 (Cash/Cheques)' },
    { id: 'cnt_bank_2', name: 'Teller Counter 2 (Express Cash)' },
    { id: 'cnt_bank_3', name: 'Cabin 3 - Loan Officer Sharma' }
  ];

  for (const c of bankCounters) {
    db.prepare(`
      INSERT INTO counters (id, organization_id, branch_id, name, current_staff_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(c.id, bankId, bankBranchId, c.name, 'Bank Officer', now);
  }

  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_cash', 'cnt_bank_1')`).run();
  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_cash', 'cnt_bank_2')`).run();
  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_loan', 'cnt_bank_3')`).run();

  // 3. SERVICE CENTRE: Metro Citizen Service Centre
  const svcId = 'org_gov_03';
  db.prepare(`
    INSERT INTO organizations (id, name, type, description, created_at)
    VALUES (?, ?, 'SERVICE_CENTRE', ?, ?)
  `).run(
    svcId,
    'Metro Citizen Service Centre',
    'Unified public service counter for passports, driving licences, and civic verification',
    now
  );

  const svcBranchId = 'br_gov_main';
  db.prepare(`
    INSERT INTO branches (id, organization_id, name, address, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(svcBranchId, svcId, 'Civic Center Complex, North Wing', 'Block B, Sector 17, Civic Plaza', now);

  const govServices = [
    {
      id: 'srv_passport',
      name: 'Passport Services & Police Clearance',
      code: 'PAS',
      grace: 5,
      threshold: 2,
      avgMins: 9.0,
      priorities: [
        { key: 'SENIOR', label: 'Senior Citizen & Specially Abled', weight: 50 },
        { key: 'NORMAL', label: 'Regular Applicant', weight: 10 }
      ],
      optionalFields: [
        {
          key: 'application_arn',
          label: 'Application ARN / Reference #',
          type: 'text',
          required: false
        },
        {
          key: 'service_subtype',
          label: 'Service Category',
          type: 'select',
          options: ['Normal Fresh / Re-issue', 'Tatkaal Verification', 'Police Clearance Certificate (PCC)'],
          required: false
        }
      ]
    },
    {
      id: 'srv_licence',
      name: 'Driving Licence & Smart Card Renewal',
      code: 'LIC',
      grace: 5,
      threshold: 2,
      avgMins: 7.0,
      priorities: [
        { key: 'SENIOR', label: 'Senior Citizen', weight: 50 },
        { key: 'NORMAL', label: 'Standard Queue', weight: 10 }
      ],
      optionalFields: [
        {
          key: 'licence_num',
          label: 'Existing Licence / Learner #',
          type: 'text',
          required: false
        }
      ]
    }
  ];

  for (const s of govServices) {
    db.prepare(`
      INSERT INTO services (
        id, organization_id, branch_id, name, code, grace_period_mins,
        notification_threshold, avg_service_mins, priority_levels_json, optional_fields_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      s.id, svcId, svcBranchId, s.name, s.code, s.grace,
      s.threshold, s.avgMins, JSON.stringify(s.priorities), JSON.stringify(s.optionalFields), now
    );
  }

  const govCounters = [
    { id: 'cnt_gov_1', name: 'Biometric Station A' },
    { id: 'cnt_gov_2', name: 'Biometric Station B' },
    { id: 'cnt_gov_3', name: 'Licence Verification Desk 1' }
  ];

  for (const c of govCounters) {
    db.prepare(`
      INSERT INTO counters (id, organization_id, branch_id, name, current_staff_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(c.id, svcId, svcBranchId, c.name, 'Officer Patel', now);
  }

  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_passport', 'cnt_gov_1')`).run();
  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_passport', 'cnt_gov_2')`).run();
  db.prepare(`INSERT INTO service_counters (service_id, counter_id) VALUES ('srv_licence', 'cnt_gov_3')`).run();

  // 4. Seed Staff Users
  const staffList = [
    // Super Admin
    { id: 'usr_super', orgId: hospitalId, name: 'Alex Vance', email: 'superadmin@queueless.io', role: 'SUPER_ADMIN' },
    // Hospital
    { id: 'usr_hosp_admin', orgId: hospitalId, name: 'Dr. Ramesh Gupta', email: 'admin@citycare.org', role: 'ORG_ADMIN' },
    { id: 'usr_hosp_staff', orgId: hospitalId, name: 'Dr. Mehta', email: 'dr.mehta@citycare.org', role: 'STAFF', counterId: 'cnt_hosp_1' },
    { id: 'usr_hosp_front', orgId: hospitalId, name: 'Priya Verma', email: 'frontdesk@citycare.org', role: 'FRONT_DESK' },
    // Bank
    { id: 'usr_bank_admin', orgId: bankId, name: 'Sonia Kapoor', email: 'admin@apexbank.com', role: 'ORG_ADMIN' },
    { id: 'usr_bank_staff', orgId: bankId, name: 'Vikram Malhotra', email: 'vikram.m@apexbank.com', role: 'STAFF', counterId: 'cnt_bank_1' },
    { id: 'usr_bank_front', orgId: bankId, name: 'Amit Roy', email: 'frontdesk@apexbank.com', role: 'FRONT_DESK' },
    // Service Centre
    { id: 'usr_gov_admin', orgId: svcId, name: 'Sunil Rao', email: 'director@metrocentre.gov.in', role: 'ORG_ADMIN' },
    { id: 'usr_gov_staff', orgId: svcId, name: 'Sunita Patil', email: 'patil.s@metrocentre.gov.in', role: 'STAFF', counterId: 'cnt_gov_1' }
  ];

  for (const u of staffList) {
    db.prepare(`
      INSERT INTO staff_users (id, organization_id, name, email, role, assigned_counter_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(u.id, u.orgId, u.name, u.email, u.role, u.counterId || null, now);
  }

  // 4b. Seed Completed Historical Queue Entries for Random Forest Model Training
  console.log('Seeding historical completed visits for Random Forest training...');
  const historicalStmt = db.prepare(`
    INSERT INTO queue_entries (
      id, organization_id, branch_id, service_id, token_number, tracking_code,
      customer_name, customer_phone, priority_level, priority_weight, custom_fields_json,
      status, joined_at, called_at, service_started_at, completed_at, source, date_kolkata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, 'WALK_IN', ?)
  `);

  const historicalProfiles = [
    // Cardio quick / routine checkups (~3 mins)
    { svc: 'srv_cardio', org: hospitalId, br: hospBranchId, code: 'CAR', reason: 'Routine Checkup', priority: 'NORMAL', weight: 10, targetMins: 3.0, count: 18 },
    // Cardio standard follow-ups (~7 mins)
    { svc: 'srv_cardio', org: hospitalId, br: hospBranchId, code: 'CAR', reason: 'Follow-up ECG / Echo', priority: 'NORMAL', weight: 10, targetMins: 7.0, count: 18 },
    // Cardio senior consultations (~8 mins)
    { svc: 'srv_cardio', org: hospitalId, br: hospBranchId, code: 'CAR', reason: 'Routine Checkup', priority: 'SENIOR', weight: 50, targetMins: 8.0, count: 12 },
    // Cardio emergencies (~14 mins)
    { svc: 'srv_cardio', org: hospitalId, br: hospBranchId, code: 'CAR', reason: 'Chest Pain / Angina', priority: 'EMERGENCY', weight: 100, targetMins: 14.0, count: 8 },
    // Pharmacy quick dispensing (~3 mins)
    { svc: 'srv_pharmacy', org: hospitalId, br: hospBranchId, code: 'PHA', reason: 'General Dispensing', priority: 'NORMAL', weight: 10, targetMins: 3.0, count: 15 },
    // Bank cash under 50k (~3 mins)
    { svc: 'srv_cash', org: bankId, br: bankBranchId, code: 'DEP', reason: 'Under ₹50,000', priority: 'NORMAL', weight: 10, targetMins: 3.0, count: 15 },
    // Bank cash large/overdraft (~7 mins)
    { svc: 'srv_cash', org: bankId, br: bankBranchId, code: 'DEP', reason: 'Above ₹2,00,000 (Form 60/PAN)', priority: 'PREMIUM', weight: 100, targetMins: 7.0, count: 12 },
    // Passport renewal (~4 mins) and fresh (~8 mins)
    { svc: 'srv_passport', org: svcId, br: svcBranchId, code: 'PAS', reason: 'Normal Fresh / Re-issue', priority: 'NORMAL', weight: 10, targetMins: 7.5, count: 12 }
  ];

  let histSeq = 100;
  for (const prof of historicalProfiles) {
    for (let i = 0; i < prof.count; i++) {
      histSeq++;
      const id = `hist_${prof.code.toLowerCase()}_${histSeq}`;
      const tokenNum = `${prof.code}-H${String(histSeq).padStart(3, '0')}`;
      const tracking = `q_hist_${histSeq}_${prof.code.toLowerCase()}`;
      const durationMins = Math.max(1, Math.round((prof.targetMins + (Math.random() * 0.4 - 0.2)) * 10) / 10);
      
      const startMinutesAgo = (prof.count - i) * 15 + 60;
      const startedAt = new Date(Date.now() - startMinutesAgo * 60000).toISOString();
      const completedAt = new Date(new Date(startedAt).getTime() + durationMins * 60000).toISOString();
      const joinedAt = new Date(new Date(startedAt).getTime() - 10 * 60000).toISOString();

      historicalStmt.run(
        id, prof.org, prof.br, prof.svc, tokenNum, tracking,
        `Historical Visitor ${histSeq}`, '+919800000000',
        prof.priority, prof.weight,
        JSON.stringify({ reason: prof.reason, expected_duration_mins: durationMins }),
        joinedAt, joinedAt, startedAt, completedAt, dateKolkata
      );
    }
  }

  // Train the Random Forest Regressor on the seeded historical visits
  trainModel();

  // 5. Seed Initial Queue Entries so that all views immediately have active and waiting tokens
  console.log('Seeding initial queue entries...');

  // Hospital Cardio Queue:
  // CAR-001: Person 1 (IN_SERVICE at Counter 1, takes 3 mins, started just now -> remaining 3 mins)
  // CAR-002: Person 2 (WAITING in line, takes 7 mins)
  // Newly created token or next token will have estimated wait time: 3 mins + 7 mins = 10 mins!
  const q1 = joinQueue({
    organizationId: hospitalId,
    serviceId: 'srv_cardio',
    customerName: 'Aarav Sharma',
    customerPhone: '+919876543210',
    priorityLevel: 'NORMAL',
    customFields: { reason: 'Routine Checkup', expected_duration_mins: 3 }
  });
  db.prepare(`
    UPDATE queue_entries 
    SET status = 'IN_SERVICE', assigned_counter_id = 'cnt_hosp_1', 
        called_at = datetime('now', '-30 seconds'), 
        service_started_at = datetime('now', '-15 seconds')
    WHERE token_number = 'CAR-001'
  `).run();

  const q2 = joinQueue({
    organizationId: hospitalId,
    serviceId: 'srv_cardio',
    customerName: 'Meera Sen',
    customerPhone: '+919876543211',
    priorityLevel: 'NORMAL',
    customFields: { reason: 'Follow-up ECG / Echo', expected_duration_mins: 7 }
  });

  const q3 = joinQueue({
    organizationId: hospitalId,
    serviceId: 'srv_cardio',
    customerName: 'Rohan Gupta',
    customerPhone: '+919876543212',
    priorityLevel: 'EMERGENCY',
    customFields: { reason: 'Chest Pain / Angina' }
  });

  const q4 = joinQueue({
    organizationId: hospitalId,
    serviceId: 'srv_cardio',
    customerName: 'Saraswati Iyer',
    customerPhone: '+919876543213',
    priorityLevel: 'SENIOR',
    customFields: { reason: 'Routine Checkup' }
  });

  const q5 = joinQueue({
    organizationId: hospitalId,
    serviceId: 'srv_cardio',
    customerName: 'Deepak Verma',
    customerPhone: '+919876543214',
    priorityLevel: 'NORMAL',
    customFields: { reason: 'Prescription Renewal' }
  });

  // Bank Cash Queue
  joinQueue({
    organizationId: bankId,
    serviceId: 'srv_cash',
    customerName: 'Pooja Agarwal',
    customerPhone: '+919822334455',
    priorityLevel: 'PREMIUM',
    customFields: { account_type: 'Current / Business Account' }
  });
  db.prepare(`
    UPDATE queue_entries 
    SET status = 'IN_SERVICE', assigned_counter_id = 'cnt_bank_1', 
        called_at = datetime('now', '-5 minutes'), 
        service_started_at = datetime('now', '-4 minutes')
    WHERE token_number = 'DEP-001'
  `).run();

  joinQueue({
    organizationId: bankId,
    serviceId: 'srv_cash',
    customerName: 'Kavita Joshi',
    customerPhone: '+919822334456',
    priorityLevel: 'NORMAL',
    customFields: { account_type: 'Savings Account' }
  });

  joinQueue({
    organizationId: bankId,
    serviceId: 'srv_cash',
    customerName: 'Harish Nair',
    customerPhone: '+919822334457',
    priorityLevel: 'SENIOR',
    customFields: { account_type: 'Savings Account' }
  });

  // Service Centre Passport Queue
  joinQueue({
    organizationId: svcId,
    serviceId: 'srv_passport',
    customerName: 'Vikramaditya Roy',
    customerPhone: '+919811223344',
    priorityLevel: 'NORMAL',
    customFields: { service_subtype: 'Normal Fresh / Re-issue' }
  });
  db.prepare(`
    UPDATE queue_entries 
    SET status = 'CALLED', assigned_counter_id = 'cnt_gov_1', 
        called_at = datetime('now', '-1 minutes')
    WHERE token_number = 'PAS-001'
  `).run();

  joinQueue({
    organizationId: svcId,
    serviceId: 'srv_passport',
    customerName: 'Ananya Deshmukh',
    customerPhone: '+919811223345',
    priorityLevel: 'SENIOR',
    customFields: { service_subtype: 'Tatkaal Verification' }
  });

  console.log('Seeding complete! Sample tracking codes generated.');
  return {
    hospitalId,
    bankId,
    svcId,
    sampleHospitalTrackingCode: q3.trackingCode,
    sampleSeniorTrackingCode: q4.trackingCode
  };
}

if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase();
}
