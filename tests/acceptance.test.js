import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, initSchema } from '../server/db.js';
import { seedDatabase } from '../server/seed.js';
import {
  joinQueue,
  transitionStatus,
  callNextToken,
  requeueToken,
  changePriority,
  getCustomerTrackingView,
  getDisplayBoardView,
  getNextTokenNumber,
  QueueEngineError
} from '../server/queueEngine.js';
import { getAuditLogs } from '../server/auditLogger.js';

describe('Queueless PRD Acceptance Criteria Test Suite', () => {
  before(() => {
    seedDatabase();
  });

  // AC 1: Two organizations can run simultaneously with no data visible across tenants
  test('AC-1: Multi-tenancy - Zero cross-tenant data leakage', () => {
    const orgs = db.prepare('SELECT id FROM organizations').all();
    const hospId = 'org_hospital_01';
    const bankId = 'org_bank_02';

    // Verify hospital and bank services exist
    const hospService = db.prepare('SELECT id FROM services WHERE organization_id = ?').get(hospId);
    const bankService = db.prepare('SELECT id FROM services WHERE organization_id = ?').get(bankId);

    assert.ok(hospService, 'Hospital must have services');
    assert.ok(bankService, 'Bank must have services');

    // Attempt to join bank service with hospital organization_id -> MUST fail with 404
    assert.throws(
      () => {
        joinQueue({
          organizationId: hospId,
          serviceId: bankService.id, // cross-tenant mismatch!
          customerName: 'Intruder',
          customerPhone: '+919999999999'
        });
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.match(err.message, /Service not found for this organization/);
        return true;
      }
    );

    // Queries scoped by organization_id return ONLY that organization's entries
    const hospEntries = db.prepare('SELECT * FROM queue_entries WHERE organization_id = ?').all(hospId);
    const bankEntries = db.prepare('SELECT * FROM queue_entries WHERE organization_id = ?').all(bankId);

    assert.ok(hospEntries.length > 0);
    assert.ok(bankEntries.length > 0);

    for (const e of hospEntries) {
      assert.equal(e.organization_id, hospId);
    }
    for (const e of bankEntries) {
      assert.equal(e.organization_id, bankId);
    }
  });

  // AC 2: Concurrent joins to the same service never produce duplicate tokens
  test('AC-2: Concurrency & Correctness - Token generation produces unique sequential tokens', () => {
    const service = db.prepare("SELECT * FROM services WHERE code = 'PHA'").get();
    assert.ok(service);

    const generatedTokens = new Set();
    const count = 25;

    // Simulate 25 rapid/concurrent token generation requests
    for (let i = 0; i < count; i++) {
      const token = getNextTokenNumber(service.id, service.code);
      assert.ok(!generatedTokens.has(token), `Duplicate token detected: ${token}`);
      generatedTokens.add(token);
      assert.match(token, new RegExp(`^${service.code}-\\d{3}$`));
    }

    assert.equal(generatedTokens.size, count);
  });

  // AC 3: Invalid status transitions return 409 and leave state unchanged
  test('AC-3: Status Lifecycle - Invalid transitions return 409 and leave state unchanged', () => {
    const hospId = 'org_hospital_01';
    const service = db.prepare("SELECT * FROM services WHERE organization_id = ? AND code = 'ORT'").get(hospId);

    // Create a new WAITING ticket
    const entry = joinQueue({
      organizationId: hospId,
      serviceId: service.id,
      customerName: 'Test Patient',
      customerPhone: '+919876543200',
      priorityLevel: 'NORMAL'
    });

    const initial = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entry.id);
    assert.equal(initial.status, 'WAITING');

    // Attempt WAITING -> IN_SERVICE directly (Invalid! Must be CALLED first)
    assert.throws(
      () => {
        transitionStatus({
          entryId: entry.id,
          organizationId: hospId,
          targetStatus: 'IN_SERVICE'
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /Invalid status transition from WAITING to IN_SERVICE/);
        return true;
      }
    );

    // Verify state remains UNCHANGED
    const unchanged = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entry.id);
    assert.equal(unchanged.status, 'WAITING');

    // Valid transition: WAITING -> CALLED
    const called = transitionStatus({
      entryId: entry.id,
      organizationId: hospId,
      targetStatus: 'CALLED',
      counterId: 'cnt_hosp_3'
    });
    assert.equal(called.status, 'CALLED');

    // Valid transition: CALLED -> IN_SERVICE
    const inService = transitionStatus({
      entryId: entry.id,
      organizationId: hospId,
      targetStatus: 'IN_SERVICE'
    });
    assert.equal(inService.status, 'IN_SERVICE');

    // Valid transition: IN_SERVICE -> COMPLETED
    const completed = transitionStatus({
      entryId: entry.id,
      organizationId: hospId,
      targetStatus: 'COMPLETED'
    });
    assert.equal(completed.status, 'COMPLETED');

    // Attempt COMPLETED -> CALLED (Invalid transition from terminal state!)
    assert.throws(
      () => {
        transitionStatus({
          entryId: entry.id,
          organizationId: hospId,
          targetStatus: 'CALLED'
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  // AC 4: A priority entry is called before a normal entry that joined earlier, and change is audit-logged
  test('AC-4: Fair Ordering & Priority - Priority entry jumps ahead of earlier normal entry and logs audit', () => {
    const hospId = 'org_hospital_01';
    const srv = db.prepare("SELECT * FROM services WHERE organization_id = ? AND code = 'CAR'").get(hospId);

    // Clear WAITING entries for this test to have exact deterministic queue
    db.prepare("DELETE FROM queue_entries WHERE service_id = ? AND status = 'WAITING'").run(srv.id);

    // Customer A (Normal) joins FIRST
    const customerA = joinQueue({
      organizationId: hospId,
      serviceId: srv.id,
      customerName: 'Normal Customer A',
      customerPhone: '+919111111111',
      priorityLevel: 'NORMAL'
    });

    // Customer B (Emergency) joins AFTER Customer A
    const customerB = joinQueue({
      organizationId: hospId,
      serviceId: srv.id,
      customerName: 'Emergency Customer B',
      customerPhone: '+919222222222',
      priorityLevel: 'EMERGENCY'
    });

    // Call Next Token!
    const staff = { id: 'usr_hosp_staff', name: 'Dr. Mehta', role: 'STAFF' };
    const calledToken = callNextToken({
      serviceId: srv.id,
      counterId: 'cnt_hosp_1',
      organizationId: hospId,
      staffUser: staff
    });

    // Customer B MUST be called first because EMERGENCY has higher priority weight than NORMAL
    assert.equal(calledToken.id, customerB.id, 'Emergency priority entry must be called before earlier normal entry');
    assert.equal(calledToken.token_number, customerB.tokenNumber);

    // Now test Priority Change & Audit Logging
    const priorityChange = changePriority({
      entryId: customerA.id,
      organizationId: hospId,
      newPriorityLevel: 'EMERGENCY',
      reason: 'Patient sudden acute distress in waiting room',
      staffUser: staff
    });

    assert.equal(priorityChange.priority_level, 'EMERGENCY');
    assert.equal(priorityChange.priority_weight, 100);

    // Verify Audit Log entry exists
    const logs = getAuditLogs(hospId, 10);
    const log = logs.find(l => l.action === 'PRIORITY_CHANGED' && l.entity_id === customerA.id);
    assert.ok(log, 'Priority change must be written to audit log');
    assert.equal(log.details.oldPriority, 'NORMAL');
    assert.equal(log.details.newPriority, 'EMERGENCY');
    assert.equal(log.actor_name, 'Dr. Mehta');
  });

  // AC 5: The tracking page and display board show no customer names
  test('AC-5: Privacy - Tracking page and display board NEVER expose customer names or phone numbers', () => {
    const hospId = 'org_hospital_01';
    const srv = db.prepare("SELECT * FROM services WHERE organization_id = ? AND code = 'CAR'").get(hospId);

    const sensitiveName = 'Secret Patient Kumar';
    const sensitivePhone = '+919876500000';

    const entry = joinQueue({
      organizationId: hospId,
      serviceId: srv.id,
      customerName: sensitiveName,
      customerPhone: sensitivePhone,
      priorityLevel: 'NORMAL'
    });

    // Fetch tracking page
    const trackingView = getCustomerTrackingView(entry.trackingCode);
    const trackingJson = JSON.stringify(trackingView);

    assert.ok(!trackingJson.includes(sensitiveName), 'Customer name must NOT be present in tracking view');
    assert.ok(!trackingJson.includes(sensitivePhone), 'Customer phone must NOT be present in tracking view');
    assert.equal(trackingView.customerName, undefined);
    assert.equal(trackingView.customerPhone, undefined);

    // Fetch display board
    const displayView = getDisplayBoardView(srv.id);
    const displayJson = JSON.stringify(displayView);

    assert.ok(!displayJson.includes(sensitiveName), 'Customer name must NOT be present in display board view');
    assert.ok(!displayJson.includes(sensitivePhone), 'Customer phone must NOT be present in display board view');
  });

  // AC 6: A CALLED token not acknowledged within grace period becomes NO_SHOW and can be re-queued exactly once
  test('AC-6: No-Show & Single Re-queue - NO_SHOW can be re-queued once; second re-queue is rejected with 409', () => {
    const hospId = 'org_hospital_01';
    const srv = db.prepare("SELECT * FROM services WHERE organization_id = ? AND code = 'PHA'").get(hospId);
    const staff = { id: 'usr_hosp_staff', name: 'Pharmacist Ravi', role: 'STAFF' };

    const entry = joinQueue({
      organizationId: hospId,
      serviceId: srv.id,
      customerName: 'NoShow Patient',
      customerPhone: '+919998887776',
      priorityLevel: 'NORMAL'
    });

    // 1. Transition WAITING -> CALLED
    transitionStatus({
      entryId: entry.id,
      organizationId: hospId,
      targetStatus: 'CALLED',
      counterId: 'cnt_hosp_4',
      staffUser: staff
    });

    // 2. Mark NO_SHOW (simulating unacknowledged grace period timeout)
    const noShow = transitionStatus({
      entryId: entry.id,
      organizationId: hospId,
      targetStatus: 'NO_SHOW',
      staffUser: staff
    });
    assert.equal(noShow.status, 'NO_SHOW');

    // 3. Re-queue token (FIRST time - MUST SUCCEED)
    const requeued = requeueToken({
      entryId: entry.id,
      organizationId: hospId,
      staffUser: staff
    });

    assert.equal(requeued.status, 'WAITING');
    assert.equal(requeued.requeue_count, 1);

    // 4. Call it again and mark NO_SHOW again
    transitionStatus({
      entryId: entry.id,
      organizationId: hospId,
      targetStatus: 'CALLED',
      counterId: 'cnt_hosp_4',
      staffUser: staff
    });
    transitionStatus({
      entryId: entry.id,
      organizationId: hospId,
      targetStatus: 'NO_SHOW',
      staffUser: staff
    });

    // 5. Attempt second re-queue -> MUST FAIL WITH 409!
    assert.throws(
      () => {
        requeueToken({
          entryId: entry.id,
          organizationId: hospId,
          staffUser: staff
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /already been re-queued once/);
        return true;
      }
    );
  });
});
