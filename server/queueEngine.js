import { db, getKolkataDate, getUtcIso } from './db.js';
import crypto from 'node:crypto';
import { logAudit } from './auditLogger.js';
import { triggerAlmostTurnNotification } from './notificationService.js';
import { estimateWaitTime } from './waitTimeService.js';

// Valid lifecycle transitions according to PRD FR-11 & FR-12
const VALID_TRANSITIONS = {
  WAITING: ['CALLED', 'CANCELLED'],
  CALLED: ['IN_SERVICE', 'SKIPPED', 'NO_SHOW'],
  IN_SERVICE: ['COMPLETED'],
  SKIPPED: ['WAITING'], // Allowed re-queue (max 1 time)
  NO_SHOW: ['WAITING'], // Allowed re-queue (max 1 time)
  COMPLETED: [],
  CANCELLED: []
};

/**
 * Custom error class for Queue Engine errors
 */
export class QueueEngineError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'QueueEngineError';
    this.statusCode = statusCode;
  }
}

/**
 * Atomically generates the next token number for a service for today (Asia/Kolkata)
 * Locked in a transaction to prevent duplicates under concurrency (PRD FR-8, AC-2)
 */
export function getNextTokenNumber(serviceId, serviceCode) {
  const dateKolkata = getKolkataDate();

  db.exec('BEGIN IMMEDIATE;');
  try {
    // Upsert or fetch sequence counter
    const existing = db.prepare(`
      SELECT current_seq FROM service_sequences 
      WHERE service_id = ? AND date_kolkata = ?
    `).get(serviceId, dateKolkata);

    let nextSeq = 1;
    if (existing) {
      nextSeq = existing.current_seq + 1;
      db.prepare(`
        UPDATE service_sequences 
        SET current_seq = ? 
        WHERE service_id = ? AND date_kolkata = ?
      `).run(nextSeq, serviceId, dateKolkata);
    } else {
      db.prepare(`
        INSERT INTO service_sequences (service_id, date_kolkata, current_seq) 
        VALUES (?, ?, ?)
      `).run(serviceId, dateKolkata, nextSeq);
    }

    db.exec('COMMIT;');
    const padded = String(nextSeq).padStart(3, '0');
    return `${serviceCode}-${padded}`;
  } catch (err) {
    try { db.exec('ROLLBACK;'); } catch (_) {}
    throw err;
  }
}

/**
 * Join Queue (Online or Walk-in)
 * PRD FR-2, FR-3, FR-8, FR-9
 */
export function joinQueue({
  organizationId,
  serviceId,
  customerName,
  customerPhone,
  priorityLevel = 'NORMAL',
  customFields = {},
  source = 'ONLINE'
}) {
  if (!organizationId) throw new QueueEngineError('Organization ID is required', 400);
  if (!serviceId) throw new QueueEngineError('Service ID is required', 400);
  if (!customerName || !customerPhone) throw new QueueEngineError('Customer name and phone are required', 400);

  // 1. Fetch service and verify organization scoping
  const service = db.prepare(`
    SELECT * FROM services WHERE id = ? AND organization_id = ? AND is_active = 1
  `).get(serviceId, organizationId);

  if (!service) {
    throw new QueueEngineError('Service not found for this organization', 404);
  }

  // 2. Resolve priority weight from service configuration
  const priorityConfigs = JSON.parse(service.priority_levels_json || '[]');
  const matchedPriority = priorityConfigs.find(
    p => p.key.toUpperCase() === priorityLevel.toUpperCase()
  );
  const priorityWeight = matchedPriority ? matchedPriority.weight : 10;
  const canonicalPriority = matchedPriority ? matchedPriority.key : 'NORMAL';

  // 3. Generate locked token and high-entropy unguessable tracking code
  const tokenNumber = getNextTokenNumber(service.id, service.code);
  const trackingCode = 'q_' + crypto.randomBytes(12).toString('hex');
  const id = 'entry_' + crypto.randomBytes(8).toString('hex');
  const nowUtc = getUtcIso();
  const dateKolkata = getKolkataDate();

  // 4. Insert queue entry
  const insertStmt = db.prepare(`
    INSERT INTO queue_entries (
      id, organization_id, branch_id, service_id, token_number, tracking_code,
      customer_name, customer_phone, priority_level, priority_weight, custom_fields_json,
      status, joined_at, source, date_kolkata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?, ?)
  `);

  insertStmt.run(
    id,
    organizationId,
    service.branch_id,
    service.id,
    tokenNumber,
    trackingCode,
    customerName,
    customerPhone,
    canonicalPriority,
    priorityWeight,
    JSON.stringify(customFields),
    nowUtc,
    source,
    dateKolkata
  );

  const entry = db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(id);

  // Check queue alerts for newly joined entry
  notifyAffectedQueueMembers(service.id, organizationId);

  const { positionAhead, estimatedWaitMins, waitMethod, activeCounters, breakdown, calculationFormula, rfDetails } =
    getQueuePositionAndEstimate(entry);

  return {
    id: entry.id,
    tokenNumber: entry.token_number,
    trackingCode: entry.tracking_code,
    priorityLevel: entry.priority_level,
    joinedAt: entry.joined_at,
    serviceName: service.name,
    serviceCode: service.code,
    positionAhead,
    estimatedWaitMins,
    waitMethod,
    activeCounters,
    breakdown,
    calculationFormula,
    rfDetails
  };
}

/**
 * Calculate customer's current queue position and wait estimate
 * PRD FR-4, FR-13
 */
export function getQueuePositionAndEstimate(entry) {
  if (entry.status !== 'WAITING') {
    return {
      positionAhead: 0,
      totalWaiting: 0,
      estimatedWaitMins: 0,
      waitMethod: 'current_status_' + entry.status.toLowerCase(),
      breakdown: [],
      calculationFormula: `Status is ${entry.status}`
    };
  }

  // Count how many WAITING entries for the same service have higher priority,
  // or equal priority but earlier joined_at (PRD FR-9)
  const positionQuery = db.prepare(`
    SELECT COUNT(*) as count 
    FROM queue_entries 
    WHERE service_id = ? 
      AND status = 'WAITING'
      AND (
        priority_weight > ? 
        OR (priority_weight = ? AND joined_at < ?)
      )
  `).get(entry.service_id, entry.priority_weight, entry.priority_weight, entry.joined_at);

  const positionAhead = positionQuery?.count || 0;

  const totalWaitingQuery = db.prepare(`
    SELECT COUNT(*) as count 
    FROM queue_entries 
    WHERE service_id = ? AND status = 'WAITING'
  `).get(entry.service_id);

  const totalWaiting = totalWaitingQuery?.count || 1;

  const waitEst = estimateWaitTime({
    serviceId: entry.service_id,
    positionAhead,
    organizationId: entry.organization_id,
    priorityWeight: entry.priority_weight,
    entryId: entry.id,
    joinedAt: entry.joined_at
  });

  return {
    positionAhead,
    totalWaiting,
    estimatedWaitMins: waitEst.minutes,
    waitMethod: waitEst.method,
    activeCounters: waitEst.activeCounters,
    breakdown: waitEst.breakdown || [],
    calculationFormula: waitEst.calculationFormula || '',
    rfDetails: waitEst.rfDetails || null
  };
}

/**
 * Public Customer Tracking View (/track/:code)
 * PRD FR-4, FR-5, FR-6, AC-5: NEVER exposes customer name or phone!
 */
export function getCustomerTrackingView(trackingCode) {
  if (!trackingCode) throw new QueueEngineError('Tracking code is required', 400);

  const entry = db.prepare(`
    SELECT 
      q.id, q.organization_id, q.service_id, q.token_number, q.tracking_code,
      q.priority_level, q.priority_weight, q.status, q.assigned_counter_id,
      q.joined_at, q.called_at, q.service_started_at, q.completed_at,
      s.name as service_name, s.code as service_code, s.grace_period_mins, s.notification_threshold,
      o.name as organization_name, o.type as organization_type,
      c.name as counter_name
    FROM queue_entries q
    JOIN services s ON q.service_id = s.id
    JOIN organizations o ON q.organization_id = o.id
    LEFT JOIN counters c ON q.assigned_counter_id = c.id
    WHERE q.tracking_code = ?
  `).get(trackingCode);

  if (!entry) {
    throw new QueueEngineError('Invalid or expired tracking code', 404);
  }

  const { positionAhead, totalWaiting, estimatedWaitMins, waitMethod, activeCounters, breakdown, calculationFormula, rfDetails } =
    getQueuePositionAndEstimate(entry);

  const isAlmostTurn = entry.status === 'WAITING' && positionAhead <= (entry.notification_threshold || 2);

  return {
    tokenNumber: entry.token_number,
    trackingCode: entry.tracking_code,
    status: entry.status,
    serviceName: entry.service_name,
    serviceCode: entry.service_code,
    organizationName: entry.organization_name,
    organizationType: entry.organization_type,
    priorityLevel: entry.priority_level,
    assignedCounter: entry.counter_name || null,
    positionAhead,
    totalWaiting,
    estimatedWaitMins,
    waitMethod,
    activeCounters,
    breakdown: breakdown || [],
    calculationFormula: calculationFormula || '',
    rfDetails: rfDetails || null,
    isAlmostTurn,
    joinedAt: entry.joined_at,
    calledAt: entry.called_at,
    gracePeriodMins: entry.grace_period_mins,
    canCancel: entry.status === 'WAITING'
  };
}

/**
 * Public Waiting Area Display Board (/display/:serviceId)
 * PRD FR-7, AC-5: Shows tokens currently called and next waiting tokens. ZERO customer names.
 */
export function getDisplayBoardView(serviceId) {
  const service = db.prepare(`
    SELECT s.*, o.name as org_name, o.type as org_type
    FROM services s
    JOIN organizations o ON s.organization_id = o.id
    WHERE s.id = ?
  `).get(serviceId);

  if (!service) {
    throw new QueueEngineError('Service not found', 404);
  }

  // Current called and in-service tokens
  const activeEntries = db.prepare(`
    SELECT 
      q.token_number, q.status, q.called_at, q.priority_level,
      c.name as counter_name
    FROM queue_entries q
    LEFT JOIN counters c ON q.assigned_counter_id = c.id
    WHERE q.service_id = ? AND q.status IN ('CALLED', 'IN_SERVICE')
    ORDER BY q.called_at DESC
    LIMIT 6
  `).all(serviceId);

  // Next waiting tokens ordered by priority then join time (PRD FR-9)
  const waitingEntries = db.prepare(`
    SELECT 
      token_number, priority_level, joined_at
    FROM queue_entries
    WHERE service_id = ? AND status = 'WAITING'
    ORDER BY priority_weight DESC, joined_at ASC
    LIMIT 8
  `).all(serviceId);

  const totalWaitingCount = db.prepare(`
    SELECT COUNT(*) as count FROM queue_entries
    WHERE service_id = ? AND status = 'WAITING'
  `).get(serviceId)?.count || 0;

  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceCode: service.code,
    organizationName: service.org_name,
    organizationType: service.org_type,
    nowServing: activeEntries.map(e => ({
      tokenNumber: e.token_number,
      counterName: e.counter_name || 'Counter Assigned',
      status: e.status,
      calledAt: e.called_at,
      priorityLevel: e.priority_level
    })),
    upNext: waitingEntries.map((e, idx) => ({
      position: idx + 1,
      tokenNumber: e.token_number,
      priorityLevel: e.priority_level,
      joinedAt: e.joined_at
    })),
    totalWaiting: totalWaitingCount,
    lastUpdated: getUtcIso()
  };
}

/**
 * Validate and transition status (PRD FR-11, AC-3)
 * Invalid transitions MUST throw 409 Conflict and leave state unchanged.
 */
export function transitionStatus({
  entryId,
  organizationId,
  targetStatus,
  counterId = null,
  staffUser = { id: 'staff', name: 'Staff User', role: 'STAFF' }
}) {
  const entry = db.prepare(`
    SELECT * FROM queue_entries WHERE id = ? AND organization_id = ?
  `).get(entryId, organizationId);

  if (!entry) {
    throw new QueueEngineError('Queue entry not found for this organization', 404);
  }

  const currentStatus = entry.status;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(targetStatus)) {
    throw new QueueEngineError(
      `Invalid status transition from ${currentStatus} to ${targetStatus}`,
      409
    );
  }

  const nowUtc = getUtcIso();
  let updateSql = `UPDATE queue_entries SET status = ?`;
  const params = [targetStatus];

  if (targetStatus === 'CALLED') {
    updateSql += `, called_at = ?, assigned_counter_id = ?, called_by_staff_id = ?`;
    params.push(nowUtc, counterId || entry.assigned_counter_id, staffUser.id);
  } else if (targetStatus === 'IN_SERVICE') {
    updateSql += `, service_started_at = ?`;
    params.push(nowUtc);
  } else if (targetStatus === 'COMPLETED') {
    updateSql += `, completed_at = ?`;
    params.push(nowUtc);
  }

  updateSql += ` WHERE id = ? AND organization_id = ?`;
  params.push(entryId, organizationId);

  db.prepare(updateSql).run(...params);

  // Audit log sensitive overrides/status transitions
  logAudit({
    organizationId,
    action: `STATUS_${targetStatus}`,
    entityType: 'QUEUE_ENTRY',
    entityId: entryId,
    actorId: staffUser.id,
    actorName: staffUser.name,
    actorRole: staffUser.role,
    details: {
      tokenNumber: entry.token_number,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      counterId
    }
  });

  // Re-notify queue members as position shifts
  notifyAffectedQueueMembers(entry.service_id, organizationId);

  return db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(entryId);
}

/**
 * Call Next Waiting Token (PRD FR-9, FR-15)
 * Returns the highest priority, earliest joined WAITING token.
 */
export function callNextToken({
  serviceId,
  counterId,
  organizationId,
  staffUser
}) {
  // Order strictly by priority_weight DESC, then joined_at ASC (PRD FR-9, AC-4)
  const nextEntry = db.prepare(`
    SELECT * FROM queue_entries
    WHERE service_id = ? AND organization_id = ? AND status = 'WAITING'
    ORDER BY priority_weight DESC, joined_at ASC
    LIMIT 1
  `).get(serviceId, organizationId);

  if (!nextEntry) {
    return null;
  }

  return transitionStatus({
    entryId: nextEntry.id,
    organizationId,
    targetStatus: 'CALLED',
    counterId,
    staffUser
  });
}

/**
 * Re-queue a NO_SHOW or SKIPPED token (PRD FR-12, AC-6)
 * Staff may re-queue a no-show/skipped token exactly ONCE.
 */
export function requeueToken({
  entryId,
  organizationId,
  staffUser
}) {
  const entry = db.prepare(`
    SELECT * FROM queue_entries WHERE id = ? AND organization_id = ?
  `).get(entryId, organizationId);

  if (!entry) {
    throw new QueueEngineError('Queue entry not found', 404);
  }

  if (entry.status !== 'NO_SHOW' && entry.status !== 'SKIPPED') {
    throw new QueueEngineError(`Only NO_SHOW or SKIPPED tokens can be re-queued. Current status: ${entry.status}`, 409);
  }

  // PRD FR-12 & AC-6: Re-queue permitted exactly ONCE
  if (entry.requeue_count >= 1) {
    throw new QueueEngineError('This token has already been re-queued once and cannot be re-queued again', 409);
  }

  const nowUtc = getUtcIso();
  db.prepare(`
    UPDATE queue_entries 
    SET status = 'WAITING', 
        requeue_count = requeue_count + 1,
        called_at = NULL,
        assigned_counter_id = NULL
    WHERE id = ? AND organization_id = ?
  `).run(entryId, organizationId);

  logAudit({
    organizationId,
    action: 'RE_QUEUED',
    entityType: 'QUEUE_ENTRY',
    entityId: entryId,
    actorId: staffUser.id,
    actorName: staffUser.name,
    actorRole: staffUser.role,
    details: {
      tokenNumber: entry.token_number,
      previousStatus: entry.status,
      newRequeueCount: entry.requeue_count + 1
    }
  });

  notifyAffectedQueueMembers(entry.service_id, organizationId);

  return db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(entryId);
}

/**
 * Change priority level with audit logging (PRD FR-10, AC-4)
 */
export function changePriority({
  entryId,
  organizationId,
  newPriorityLevel,
  reason = 'Staff triage override',
  staffUser
}) {
  const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'STAFF'];
  if (!allowedRoles.includes(staffUser.role)) {
    throw new QueueEngineError('Unauthorized to change priority', 403);
  }

  const entry = db.prepare(`
    SELECT q.*, s.priority_levels_json 
    FROM queue_entries q
    JOIN services s ON q.service_id = s.id
    WHERE q.id = ? AND q.organization_id = ?
  `).get(entryId, organizationId);

  if (!entry) throw new QueueEngineError('Queue entry not found', 404);

  const priorityConfigs = JSON.parse(entry.priority_levels_json || '[]');
  const matched = priorityConfigs.find(p => p.key.toUpperCase() === newPriorityLevel.toUpperCase());
  if (!matched) {
    throw new QueueEngineError(`Invalid priority level "${newPriorityLevel}" for this service`, 400);
  }

  const oldPriority = entry.priority_level;
  const oldWeight = entry.priority_weight;

  db.prepare(`
    UPDATE queue_entries 
    SET priority_level = ?, priority_weight = ? 
    WHERE id = ? AND organization_id = ?
  `).run(matched.key, matched.weight, entryId, organizationId);

  logAudit({
    organizationId,
    action: 'PRIORITY_CHANGED',
    entityType: 'QUEUE_ENTRY',
    entityId: entryId,
    actorId: staffUser.id,
    actorName: staffUser.name,
    actorRole: staffUser.role,
    details: {
      tokenNumber: entry.token_number,
      oldPriority,
      oldWeight,
      newPriority: matched.key,
      newWeight: matched.weight,
      reason
    }
  });

  notifyAffectedQueueMembers(entry.service_id, organizationId);

  return db.prepare(`SELECT * FROM queue_entries WHERE id = ?`).get(entryId);
}

/**
 * Handle auto no-show for expired grace periods (PRD FR-12)
 */
export function checkAndExpireGracePeriods(organizationId) {
  const now = new Date().getTime();

  const calledEntries = db.prepare(`
    SELECT q.*, s.grace_period_mins 
    FROM queue_entries q
    JOIN services s ON q.service_id = s.id
    WHERE q.status = 'CALLED' AND q.called_at IS NOT NULL
      ${organizationId ? 'AND q.organization_id = ?' : ''}
  `).all(...(organizationId ? [organizationId] : []));

  const expiredList = [];
  for (const entry of calledEntries) {
    const calledTime = new Date(entry.called_at).getTime();
    const graceMs = (entry.grace_period_mins || 5) * 60 * 1000;
    if (now - calledTime > graceMs) {
      transitionStatus({
        entryId: entry.id,
        organizationId: entry.organization_id,
        targetStatus: 'NO_SHOW',
        staffUser: { id: 'system_timer', name: 'Grace Period Expiry Timer', role: 'SYSTEM' }
      });
      expiredList.push(entry.token_number);
    }
  }

  return expiredList;
}

/**
 * Internal helper to check and dispatch "Almost your turn" notifications
 */
function notifyAffectedQueueMembers(serviceId, organizationId) {
  try {
    const service = db.prepare(`SELECT * FROM services WHERE id = ?`).get(serviceId);
    if (!service) return;

    const waitingEntries = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE service_id = ? AND organization_id = ? AND status = 'WAITING'
      ORDER BY priority_weight DESC, joined_at ASC
      LIMIT 10
    `).all(serviceId, organizationId);

    waitingEntries.forEach((entry, idx) => {
      triggerAlmostTurnNotification({
        queueEntry: entry,
        remainingAhead: idx,
        service
      });
    });
  } catch (err) {
    console.error('Error notifying queue members:', err);
  }
}
