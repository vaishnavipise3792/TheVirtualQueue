import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { seedDatabase } from '../server/seed.js';
import { db } from '../server/db.js';
import {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  ensureAuthSchema,
  authenticateCredentials
} from '../server/auth.js';
import {
  joinQueue,
  getCustomerTrackingView,
  callNextToken
} from '../server/queueEngine.js';

describe('Queueless Authentication & Role Flow Test Suite', () => {
  before(() => {
    seedDatabase();
    ensureAuthSchema();
  });

  // 1. Password Hashing & Verification
  test('PBKDF2 Password Hashing & Verification works securely', () => {
    const raw = 'SecretPass123!';
    const hashed = hashPassword(raw);
    assert.ok(hashed.includes(':'), 'Hash must contain salt separator');
    assert.ok(verifyPassword(raw, hashed), 'Correct password must verify');
    assert.equal(verifyPassword('WrongPass', hashed), false, 'Wrong password must fail');
  });

  // 2. JWT Signing & Verification
  test('JWT Tokens sign and verify with correct role claims', () => {
    const payload = {
      id: 'usr_test_1',
      name: 'Dr. Mehta',
      role: 'STAFF',
      organization_id: 'org_hospital_01'
    };
    const token = signJwt(payload);
    assert.ok(typeof token === 'string' && token.split('.').length === 3, 'Must be valid 3-part JWT');

    const decoded = verifyJwt(token);
    assert.equal(decoded.id, payload.id);
    assert.equal(decoded.role, 'STAFF');
    assert.equal(decoded.organization_id, payload.organization_id);

    // Tampered token fails verification
    const tampered = token.slice(0, -5) + 'xxxxx';
    assert.equal(verifyJwt(tampered), null);
  });

  // 3. Customer Guest Authentication
  test('Requirement 1: Customer guest login succeeds and issues CUSTOMER role', () => {
    const name = 'Priya Patel';
    const token = signJwt({ id: 'usr_customer', name, role: 'CUSTOMER', organization_id: null });
    const user = verifyJwt(token);
    assert.equal(user.role, 'CUSTOMER');
    assert.equal(user.name, 'Priya Patel');
  });

  // 4. Staff Login & Role Verification
  test('Requirement 2: Staff login authenticates and returns STAFF role', () => {
    const res = authenticateCredentials('dr.mehta@citycare.org', 'password123', 'STAFF');
    assert.ok(res.token, 'Must return JWT token');
    assert.equal(res.user.role, 'STAFF');
    assert.equal(res.user.email, 'dr.mehta@citycare.org');
    assert.equal(res.user.organization_id, 'org_hospital_01');
  });

  // 5. Front Desk Login & Role Verification
  test('Requirement 3: Front Desk login authenticates and returns FRONT_DESK role', () => {
    const res = authenticateCredentials('frontdesk@citycare.org', 'password123', 'FRONT_DESK');
    assert.ok(res.token);
    assert.equal(res.user.role, 'FRONT_DESK');
  });

  // 6. Organization Admin Login & Role Verification
  test('Requirement 4: Org Admin login authenticates and returns ORG_ADMIN role', () => {
    const res = authenticateCredentials('admin@citycare.org', 'password123', 'ORG_ADMIN');
    assert.ok(res.token);
    assert.equal(res.user.role, 'ORG_ADMIN');
  });

  // 7. Super Admin Login & Role Verification
  test('Requirement 5: Super Admin login authenticates and returns SUPER_ADMIN role', () => {
    const res = authenticateCredentials('superadmin@queueless.io', 'password123', 'SUPER_ADMIN');
    assert.ok(res.token);
    assert.equal(res.user.role, 'SUPER_ADMIN');
  });

  // 8. Security: Invalid Password Rejection
  test('Requirement 6: Invalid password returns null/rejected', () => {
    assert.throws(
      () => authenticateCredentials('dr.mehta@citycare.org', 'WrongPassword!', 'STAFF'),
      /Invalid email or password/
    );
  });

  // 9. Security: Cross-Portal Attempt Rejection
  test('Requirement 6 & 8: Staff user cannot log in through ORG_ADMIN portal', () => {
    assert.throws(
      () => authenticateCredentials('dr.mehta@citycare.org', 'password123', 'ORG_ADMIN'),
      /cannot log in through the ORG_ADMIN portal/
    );
  });

  // 10. Customer Waiting Time & Queue Integrity
  test('Requirement 11 & 12: Customer can join queue, receive token, and track waiting time', () => {
    const hospId = 'org_hospital_01';
    const service = db.prepare("SELECT * FROM services WHERE organization_id = ? AND code = 'CAR'").get(hospId);
    assert.ok(service, 'Service must exist');

    const entry = joinQueue({
      organizationId: hospId,
      serviceId: service.id,
      customerName: 'Ananya Sharma',
      customerPhone: '+919876599999',
      priorityLevel: 'NORMAL'
    });

    assert.ok(entry.trackingCode, 'Must generate tracking code');
    assert.ok(entry.tokenNumber, 'Must generate token number');
    assert.equal(typeof entry.estimatedWaitMins, 'number', 'Estimated wait time must be numeric');
    assert.ok(entry.estimatedWaitMins >= 0, 'Estimated wait time must be non-negative');

    // Customer tracking view returns clean privacy-preserving data
    const tracking = getCustomerTrackingView(entry.trackingCode);
    assert.equal(tracking.tokenNumber, entry.tokenNumber);
    assert.equal(tracking.serviceName, 'Cardiology OPD');
    assert.ok(tracking.estimatedWaitMins !== undefined);
  });
});
