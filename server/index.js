import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { db, initSchema, getUtcIso } from './db.js';
import { seedDatabase } from './seed.js';
import {
  joinQueue,
  getCustomerTrackingView,
  getDisplayBoardView,
  transitionStatus,
  callNextToken,
  requeueToken,
  changePriority,
  checkAndExpireGracePeriods,
  getQueuePositionAndEstimate,
  QueueEngineError
} from './queueEngine.js';
import { getAuditLogs, logAudit } from './auditLogger.js';
import { mlServiceInstance } from './waitTimeService.js';
import crypto from 'node:crypto';
import { ensureAuthSchema, registerAuthRoutes, requireRole, requireAuth, extractToken } from './auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize schema on boot
initSchema();

// Ensure auth columns exist and seed default passwords
ensureAuthSchema();

// Register auth routes (login / logout / me)
registerAuthRoutes(app);

// Verify if DB has organizations, if not seed it automatically
const orgCount = db.prepare('SELECT COUNT(*) as count FROM organizations').get();
if (orgCount.count === 0) {
  seedDatabase();
  // After seeding, ensure new users get their passwords too
  ensureAuthSchema();
}

// ----------------------------------------------------
// Server-Sent Events (SSE) for Real-time < 2s updates
// ----------------------------------------------------
const sseClients = new Set();

export function broadcastQueueUpdate(eventPayload = {}) {
  const data = JSON.stringify({
    timestamp: getUtcIso(),
    ...eventPayload
  });
  for (const client of sseClients) {
    try {
      client.write(`event: queue-update\ndata: ${data}\n\n`);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('\n');

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Periodic grace period check (PRD FR-12)
setInterval(() => {
  const expiredTokens = checkAndExpireGracePeriods();
  if (expiredTokens && expiredTokens.length > 0) {
    broadcastQueueUpdate({ action: 'GRACE_PERIOD_EXPIRED', tokens: expiredTokens });
  }
}, 15000);

// Helper for tenant context extraction
// Prefers explicit header/query/body param; falls back to the authenticated user's org.
function getTenantContext(req) {
  return req.headers['x-organization-id']
    || req.query.organizationId
    || req.body?.organizationId
    || req.authUser?.organization_id
    || null;
}

// Helper for staff user context extraction
// Prefers JWT-authenticated user (req.authUser) set by requireRole middleware,
// falls back to x-staff-id header for backward compatibility.
function getStaffContext(req) {
  if (req.authUser && req.authUser.id) {
    // Look up full record from DB for up-to-date details
    const staff = db.prepare(`SELECT * FROM staff_users WHERE id = ?`).get(req.authUser.id);
    if (staff) return staff;
    // JWT user not in staff_users (e.g. customer) — return the JWT payload
    return req.authUser;
  }
  const staffId = req.headers['x-staff-id'] || 'usr_demo_staff';
  const staff = db.prepare(`SELECT * FROM staff_users WHERE id = ?`).get(staffId);
  return staff || {
    id: staffId,
    name: req.headers['x-staff-name'] || 'Staff User',
    role: req.headers['x-staff-role'] || 'STAFF',
    organization_id: getTenantContext(req)
  };
}

// ----------------------------------------------------
// 1. Public Customer Routes (PRD FR-1, FR-2, FR-4, FR-6, FR-7)
// ----------------------------------------------------

// FR-1: Landing flow - choose sector type -> organization -> services
app.get('/api/public/sectors', (req, res) => {
  const organizations = db.prepare(`
    SELECT o.*, 
      (SELECT COUNT(*) FROM services s WHERE s.organization_id = o.id AND s.is_active = 1) as service_count,
      (SELECT COUNT(*) FROM queue_entries q WHERE q.organization_id = o.id AND q.status = 'WAITING') as active_waiting
    FROM organizations o
    ORDER BY o.name ASC
  `).all();

  const sectors = {
    HOSPITAL: {
      name: 'Hospitals & Healthcare',
      icon: 'HeartPulse',
      description: 'OPD clinics, triage, diagnostics, and pharmacy queues',
      organizations: organizations.filter(o => o.type === 'HOSPITAL')
    },
    BANK: {
      name: 'Banks & Financial Centres',
      icon: 'Building2',
      description: 'Teller counters, forex, loan advisory, and priority banking',
      organizations: organizations.filter(o => o.type === 'BANK')
    },
    SERVICE_CENTRE: {
      name: 'Citizen & Public Service Centres',
      icon: 'Landmark',
      description: 'Passport verification, smart licensing, and municipal services',
      organizations: organizations.filter(o => o.type === 'SERVICE_CENTRE')
    }
  };

  res.json({ sectors, allOrganizations: organizations });
});

// Organization details & active services with live queue metrics
app.get('/api/public/org/:orgId', (req, res) => {
  const org = db.prepare(`SELECT * FROM organizations WHERE id = ?`).get(req.params.orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const branches = db.prepare(`SELECT * FROM branches WHERE organization_id = ?`).all(org.id);
  const services = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM queue_entries q WHERE q.service_id = s.id AND q.status = 'WAITING') as waiting_count,
      (SELECT COUNT(*) FROM queue_entries q WHERE q.service_id = s.id AND q.status = 'CALLED') as called_count,
      (SELECT COUNT(*) FROM queue_entries q WHERE q.service_id = s.id AND q.status = 'IN_SERVICE') as in_service_count,
      (SELECT COUNT(*) FROM service_counters sc JOIN counters c ON sc.counter_id = c.id WHERE sc.service_id = s.id AND c.is_active = 1) as active_counters
    FROM services s
    WHERE s.organization_id = ? AND s.is_active = 1
  `).all(org.id);

  const parsedServices = services.map(s => {
    const estWait = s.waiting_count > 0 ? Math.round((s.avg_service_mins * s.waiting_count) / Math.max(1, s.active_counters)) : 0;
    return {
      ...s,
      priorityLevels: JSON.parse(s.priority_levels_json || '[]'),
      optionalFields: JSON.parse(s.optional_fields_json || '[]'),
      estimatedWaitMins: estWait
    };
  });

  res.json({ organization: org, branches, services: parsedServices });
});

// FR-2: Join online
app.post('/api/public/join', (req, res) => {
  try {
    const {
      organizationId,
      serviceId,
      customerName,
      customerPhone,
      priorityLevel,
      customFields
    } = req.body;

    const result = joinQueue({
      organizationId,
      serviceId,
      customerName,
      customerPhone,
      priorityLevel,
      customFields,
      source: 'ONLINE'
    });

    broadcastQueueUpdate({ action: 'NEW_TOKEN', serviceId, tokenNumber: result.tokenNumber });
    res.status(201).json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// FR-4: Customer tracking page (/track/:code) - NEVER reveals customer name or phone! (AC-5)
app.get('/api/public/track/:code', (req, res) => {
  try {
    const data = getCustomerTrackingView(req.params.code);
    res.json(data);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// FR-6: Customer cancels/leaves queue
app.post('/api/public/track/:code/cancel', (req, res) => {
  try {
    const entry = db.prepare(`SELECT * FROM queue_entries WHERE tracking_code = ?`).get(req.params.code);
    if (!entry) return res.status(404).json({ error: 'Invalid tracking code' });

    const updated = transitionStatus({
      entryId: entry.id,
      organizationId: entry.organization_id,
      targetStatus: 'CANCELLED',
      staffUser: { id: 'customer_self', name: 'Customer Self-Cancel', role: 'CUSTOMER' }
    });

    broadcastQueueUpdate({ action: 'CANCELLED', serviceId: entry.service_id, tokenNumber: entry.token_number });
    res.json({ success: true, status: updated.status, tokenNumber: entry.token_number });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// Customer Review: Submit rating (1-10) after service completion
app.post('/api/public/track/:code/review', (req, res) => {
  try {
    const { code } = req.params;
    const { rating, feedbackText } = req.body;

    // Validate rating is integer 1-10
    const ratingInt = parseInt(rating, 10);
    if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 10) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 10' });
    }

    // Find queue entry
    const entry = db.prepare(`SELECT * FROM queue_entries WHERE tracking_code = ?`).get(code);
    if (!entry) return res.status(404).json({ error: 'Invalid tracking code' });

    // Must be COMPLETED
    if (entry.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Review can only be submitted for completed services' });
    }

    // Prevent duplicate submission
    const existing = db.prepare(`SELECT id FROM customer_reviews WHERE queue_entry_id = ?`).get(entry.id);
    if (existing) {
      return res.status(409).json({ error: 'Review already submitted for this service' });
    }

    const id = 'rev_' + crypto.randomBytes(6).toString('hex');
    const now = getUtcIso();

    db.prepare(`
      INSERT INTO customer_reviews (id, queue_entry_id, organization_id, service_id, tracking_code, rating, feedback_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, entry.id, entry.organization_id, entry.service_id, code, ratingInt, feedbackText || '', now);

    res.status(201).json({ success: true, reviewId: id, rating: ratingInt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer Review: Check if review exists for this tracking code
app.get('/api/public/track/:code/review', (req, res) => {
  try {
    const entry = db.prepare(`SELECT * FROM queue_entries WHERE tracking_code = ?`).get(req.params.code);
    if (!entry) return res.status(404).json({ error: 'Invalid tracking code' });

    const review = db.prepare(`SELECT rating, feedback_text, created_at FROM customer_reviews WHERE queue_entry_id = ?`).get(entry.id);
    res.json({ hasReview: !!review, review: review || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// FR-7: Public Display Board (/display/:serviceId) - ZERO customer names! (AC-5)
app.get('/api/public/display/:serviceId', (req, res) => {
  try {
    const data = getDisplayBoardView(req.params.serviceId);
    res.json(data);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 2. Staff & Front Desk Console (PRD FR-3, FR-9, FR-11, FR-12, FR-15)
// ----------------------------------------------------

// Get live queues for staff view (scoped to organization)
// Requires STAFF, FRONT_DESK, or ORG_ADMIN role
app.get('/api/staff/queues', requireRole('STAFF', 'FRONT_DESK', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  const orgId = getTenantContext(req);
  if (!orgId) return res.status(400).json({ error: 'Organization ID is required' });

  const serviceId = req.query.serviceId;

  let query = `
    SELECT 
      q.*, s.name as service_name, s.code as service_code, s.grace_period_mins,
      c.name as counter_name
    FROM queue_entries q
    JOIN services s ON q.service_id = s.id
    LEFT JOIN counters c ON q.assigned_counter_id = c.id
    WHERE q.organization_id = ?
  `;
  const params = [orgId];

  if (serviceId) {
    query += ` AND q.service_id = ?`;
    params.push(serviceId);
  }

  // Active / today's queue entries
  query += ` ORDER BY q.joined_at DESC LIMIT 150`;

  const rows = db.prepare(query).all(...params);

  // Group by status
  const waiting = [];
  const called = [];
  const inService = [];
  const completedToday = [];
  const noShowOrSkipped = [];

  for (const r of rows) {
    const entryData = {
      ...r,
      customFields: JSON.parse(r.custom_fields_json || '{}')
    };

    if (r.status === 'WAITING') {
      const { positionAhead, estimatedWaitMins } = getQueuePositionAndEstimate(r);
      entryData.positionAhead = positionAhead;
      entryData.estimatedWaitMins = estimatedWaitMins;
      waiting.push(entryData);
    } else if (r.status === 'CALLED') {
      called.push(entryData);
    } else if (r.status === 'IN_SERVICE') {
      inService.push(entryData);
    } else if (r.status === 'COMPLETED') {
      completedToday.push(entryData);
    } else if (r.status === 'NO_SHOW' || r.status === 'SKIPPED') {
      noShowOrSkipped.push(entryData);
    }
  }

  // Waiting list sorted by priority_weight DESC then joined_at ASC
  waiting.sort((a, b) => {
    if (b.priority_weight !== a.priority_weight) return b.priority_weight - a.priority_weight;
    return new Date(a.joined_at) - new Date(b.joined_at);
  });

  res.json({
    waiting,
    called,
    inService,
    completedToday,
    noShowOrSkipped,
    totalWaiting: waiting.length
  });
});

// FR-15: Call Next Waiting Token
app.post('/api/staff/call-next', requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const orgId = getTenantContext(req);
    const staff = getStaffContext(req);
    const { serviceId, counterId } = req.body;

    if (!orgId || !serviceId) {
      return res.status(400).json({ error: 'Organization ID and Service ID required' });
    }

    const calledEntry = callNextToken({
      serviceId,
      counterId,
      organizationId: orgId,
      staffUser: staff
    });

    if (!calledEntry) {
      return res.json({ message: 'No waiting tokens in queue', entry: null });
    }

    broadcastQueueUpdate({ action: 'CALLED_NEXT', serviceId, tokenNumber: calledEntry.token_number, counterId });
    res.json({ entry: calledEntry });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// Recall current token (triggers chime / announcement)
app.post('/api/staff/recall', requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const orgId = getTenantContext(req);
    const staff = getStaffContext(req);
    const { entryId } = req.body;

    const entry = db.prepare(`SELECT * FROM queue_entries WHERE id = ? AND organization_id = ?`).get(entryId, orgId);
    if (!entry) return res.status(404).json({ error: 'Queue entry not found' });

    logAudit({
      organizationId: orgId,
      action: 'RECALLED',
      entityType: 'QUEUE_ENTRY',
      entityId: entryId,
      actorId: staff.id,
      actorName: staff.name,
      actorRole: staff.role,
      details: { tokenNumber: entry.token_number }
    });

    broadcastQueueUpdate({ action: 'RECALL', serviceId: entry.service_id, tokenNumber: entry.token_number });
    res.json({ success: true, message: `Token ${entry.token_number} recalled`, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Service (CALLED -> IN_SERVICE)
app.post('/api/staff/start-service', requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const orgId = getTenantContext(req);
    const staff = getStaffContext(req);
    const { entryId } = req.body;

    const updated = transitionStatus({
      entryId,
      organizationId: orgId,
      targetStatus: 'IN_SERVICE',
      staffUser: staff
    });

    broadcastQueueUpdate({ action: 'STARTED_SERVICE', serviceId: updated.service_id, tokenNumber: updated.token_number });
    res.json({ entry: updated });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// Complete Service (IN_SERVICE -> COMPLETED)
app.post('/api/staff/complete', requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const orgId = getTenantContext(req);
    const staff = getStaffContext(req);
    const { entryId } = req.body;

    const updated = transitionStatus({
      entryId,
      organizationId: orgId,
      targetStatus: 'COMPLETED',
      staffUser: staff
    });

    broadcastQueueUpdate({ action: 'COMPLETED', serviceId: updated.service_id, tokenNumber: updated.token_number });
    res.json({ entry: updated });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// Skip (CALLED -> SKIPPED)
app.post('/api/staff/skip', requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const orgId = getTenantContext(req);
    const staff = getStaffContext(req);
    const { entryId } = req.body;

    const updated = transitionStatus({
      entryId,
      organizationId: orgId,
      targetStatus: 'SKIPPED',
      staffUser: staff
    });

    broadcastQueueUpdate({ action: 'SKIPPED', serviceId: updated.service_id, tokenNumber: updated.token_number });
    res.json({ entry: updated });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// Mark No-Show (CALLED -> NO_SHOW)
app.post('/api/staff/no-show', requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const orgId = getTenantContext(req);
    const staff = getStaffContext(req);
    const { entryId } = req.body;

    const updated = transitionStatus({
      entryId,
      organizationId: orgId,
      targetStatus: 'NO_SHOW',
      staffUser: staff
    });

    broadcastQueueUpdate({ action: 'NO_SHOW', serviceId: updated.service_id, tokenNumber: updated.token_number });
    res.json({ entry: updated });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// FR-12 & AC-6: Re-queue a NO_SHOW or SKIPPED token (enforced max 1 time!)
app.post('/api/staff/requeue', requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const orgId = getTenantContext(req);
    const staff = getStaffContext(req);
    const { entryId } = req.body;

    const updated = requeueToken({
      entryId,
      organizationId: orgId,
      staffUser: staff
    });

    broadcastQueueUpdate({ action: 'REQUEUED', serviceId: updated.service_id, tokenNumber: updated.token_number });
    res.json({ entry: updated });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// FR-10 & AC-4: Priority change with audit logging
app.post('/api/staff/change-priority', requireRole('STAFF', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const orgId = getTenantContext(req);
    const staff = getStaffContext(req);
    const { entryId, newPriorityLevel, reason } = req.body;

    const updated = changePriority({
      entryId,
      organizationId: orgId,
      newPriorityLevel,
      reason,
      staffUser: staff
    });

    broadcastQueueUpdate({ action: 'PRIORITY_CHANGED', serviceId: updated.service_id, tokenNumber: updated.token_number });
    res.json({ entry: updated });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// FR-3: Front Desk Walk-In Registration
app.post('/api/staff/walkin', requireRole('FRONT_DESK', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const orgId = getTenantContext(req);
    const staff = getStaffContext(req);
    const {
      serviceId,
      customerName,
      customerPhone,
      priorityLevel,
      customFields
    } = req.body;

    const result = joinQueue({
      organizationId: orgId,
      serviceId,
      customerName,
      customerPhone,
      priorityLevel,
      customFields,
      source: 'WALK_IN'
    });

    logAudit({
      organizationId: orgId,
      action: 'WALKIN_REGISTERED',
      entityType: 'QUEUE_ENTRY',
      entityId: result.id,
      actorId: staff.id,
      actorName: staff.name,
      actorRole: staff.role,
      details: { tokenNumber: result.tokenNumber, priorityLevel: result.priorityLevel }
    });

    broadcastQueueUpdate({ action: 'NEW_WALKIN_TOKEN', serviceId, tokenNumber: result.tokenNumber });
    res.status(201).json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3. Org Admin & Analytics (PRD FR-16, FR-17)
// ----------------------------------------------------

// FR-17: Scoped Audit Log Viewer
app.get('/api/admin/audit-logs', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  const orgId = getTenantContext(req);
  if (!orgId) return res.status(400).json({ error: 'Organization ID is required' });

  const logs = getAuditLogs(orgId, 150);
  res.json({ logs });
});

// Counters management
app.get('/api/admin/counters', requireRole('STAFF', 'FRONT_DESK', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  const orgId = getTenantContext(req);
  if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

  const counters = db.prepare(`SELECT * FROM counters WHERE organization_id = ?`).all(orgId);
  res.json({ counters });
});

app.post('/api/admin/counters', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  const orgId = getTenantContext(req);
  const staff = getStaffContext(req);
  const { name, branchId } = req.body;

  const id = 'cnt_' + crypto.randomBytes(6).toString('hex');
  const now = getUtcIso();

  db.prepare(`
    INSERT INTO counters (id, organization_id, branch_id, name, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, orgId, branchId, name, now);

  logAudit({
    organizationId: orgId,
    action: 'COUNTER_CREATED',
    entityType: 'COUNTER',
    entityId: id,
    actorId: staff.id,
    actorName: staff.name,
    actorRole: staff.role,
    details: { name }
  });

  res.status(201).json({ id, name });
});

// Services management and configuration (FR-16)
app.get('/api/admin/services', requireRole('STAFF', 'FRONT_DESK', 'ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  const orgId = getTenantContext(req);
  if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

  const services = db.prepare(`SELECT * FROM services WHERE organization_id = ?`).all(orgId);
  const parsed = services.map(s => ({
    ...s,
    priorityLevels: JSON.parse(s.priority_levels_json || '[]'),
    optionalFields: JSON.parse(s.optional_fields_json || '[]')
  }));
  res.json({ services: parsed });
});

app.put('/api/admin/services/:id', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  const orgId = getTenantContext(req);
  const staff = getStaffContext(req);
  const serviceId = req.params.id;

  const {
    name,
    code,
    gracePeriodMins,
    notificationThreshold,
    avgServiceMins,
    priorityLevels,
    optionalFields
  } = req.body;

  const stmt = db.prepare(`
    UPDATE services 
    SET name = ?, code = ?, grace_period_mins = ?, notification_threshold = ?,
        avg_service_mins = ?, priority_levels_json = ?, optional_fields_json = ?
    WHERE id = ? AND organization_id = ?
  `);

  stmt.run(
    name,
    code,
    gracePeriodMins,
    notificationThreshold,
    avgServiceMins,
    JSON.stringify(priorityLevels || []),
    JSON.stringify(optionalFields || []),
    serviceId,
    orgId
  );

  logAudit({
    organizationId: orgId,
    action: 'SERVICE_CONFIG_UPDATED',
    entityType: 'SERVICE',
    entityId: serviceId,
    actorId: staff.id,
    actorName: staff.name,
    actorRole: staff.role,
    details: { name, code, gracePeriodMins, notificationThreshold }
  });

  broadcastQueueUpdate({ action: 'SERVICE_CONFIG_CHANGED', serviceId });
  res.json({ success: true, serviceId });
});

// Admin Analytics Dashboard
app.get('/api/admin/analytics', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  const orgId = getTenantContext(req);
  if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

  const totalToday = db.prepare(`
    SELECT COUNT(*) as count FROM queue_entries WHERE organization_id = ?
  `).get(orgId)?.count || 0;

  const completedToday = db.prepare(`
    SELECT COUNT(*) as count FROM queue_entries WHERE organization_id = ? AND status = 'COMPLETED'
  `).get(orgId)?.count || 0;

  const noShowCount = db.prepare(`
    SELECT COUNT(*) as count FROM queue_entries WHERE organization_id = ? AND status = 'NO_SHOW'
  `).get(orgId)?.count || 0;

  const activeWaiting = db.prepare(`
    SELECT COUNT(*) as count FROM queue_entries WHERE organization_id = ? AND status = 'WAITING'
  `).get(orgId)?.count || 0;

  const noShowRate = totalToday > 0 ? Math.round((noShowCount / totalToday) * 100) : 0;

  // Recent completed durations
  const durations = db.prepare(`
    SELECT (strftime('%s', completed_at) - strftime('%s', service_started_at)) / 60 as mins
    FROM queue_entries 
    WHERE organization_id = ? AND status = 'COMPLETED' AND service_started_at IS NOT NULL
    ORDER BY completed_at DESC LIMIT 20
  `).all(orgId);

  const avgDuration = durations.length > 0 
    ? Math.round((durations.reduce((acc, d) => acc + (d.mins || 0), 0) / durations.length) * 10) / 10 
    : 8.5;

  // Customer review summary
  const reviewStats = db.prepare(`
    SELECT 
      COUNT(*) as totalReviews,
      ROUND(AVG(rating), 1) as avgRating
    FROM customer_reviews WHERE organization_id = ?
  `).get(orgId);

  const ratingDistribution = db.prepare(`
    SELECT rating, COUNT(*) as count
    FROM customer_reviews WHERE organization_id = ?
    GROUP BY rating ORDER BY rating ASC
  `).all(orgId);

  // Build a full 1-10 distribution map
  const distribution = {};
  for (let i = 1; i <= 10; i++) distribution[i] = 0;
  for (const row of ratingDistribution) distribution[row.rating] = row.count;

  // Recent reviews (last 10)
  const recentReviews = db.prepare(`
    SELECT cr.rating, cr.feedback_text, cr.created_at, s.name as service_name
    FROM customer_reviews cr
    JOIN services s ON cr.service_id = s.id
    WHERE cr.organization_id = ?
    ORDER BY cr.created_at DESC LIMIT 10
  `).all(orgId);

  res.json({
    totalToday,
    completedToday,
    noShowCount,
    activeWaiting,
    noShowRate,
    avgServiceDurationMins: avgDuration,
    mlServiceStatus: mlServiceInstance.isServiceAvailable ? 'HEALTHY' : 'DEGRADED_TO_HEURISTIC',
    reviewSummary: {
      totalReviews: reviewStats?.totalReviews || 0,
      avgRating: reviewStats?.avgRating || 0,
      distribution,
      recentReviews
    }
  });
});

// Staff users
app.get('/api/admin/staff', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  const orgId = getTenantContext(req);
  if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

  const staff = db.prepare(`
    SELECT u.*, c.name as counter_name 
    FROM staff_users u
    LEFT JOIN counters c ON u.assigned_counter_id = c.id
    WHERE u.organization_id = ?
  `).all(orgId);

  res.json({ staff });
});

// ----------------------------------------------------
// 4. Super Admin Routes (PRD FR-14, FR-1)
// ----------------------------------------------------
app.get('/api/superadmin/organizations', requireRole('SUPER_ADMIN'), (req, res) => {
  const orgs = db.prepare(`
    SELECT o.*,
      (SELECT COUNT(*) FROM services s WHERE s.organization_id = o.id) as service_count,
      (SELECT COUNT(*) FROM counters c WHERE c.organization_id = o.id) as counter_count,
      (SELECT COUNT(*) FROM queue_entries q WHERE q.organization_id = o.id) as total_entries
    FROM organizations o
    ORDER BY o.created_at DESC
  `).all();
  res.json({ organizations: orgs });
});

app.post('/api/superadmin/organizations', requireRole('SUPER_ADMIN'), (req, res) => {
  const { name, type, description } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

  const id = 'org_' + crypto.randomBytes(6).toString('hex');
  const now = getUtcIso();

  db.prepare(`
    INSERT INTO organizations (id, name, type, description, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, type, description || '', now);

  // Create default branch
  const branchId = 'br_' + crypto.randomBytes(6).toString('hex');
  db.prepare(`
    INSERT INTO branches (id, organization_id, name, address, created_at)
    VALUES (?, ?, 'Main Branch', 'Primary Location', ?)
  `).run(branchId, id, now);

  res.status(201).json({ id, name, type });
});

// Demo seeder reset endpoint
app.post('/api/superadmin/reset-demo', requireRole('SUPER_ADMIN'), (req, res) => {
  const result = seedDatabase();
  broadcastQueueUpdate({ action: 'DATABASE_RESET' });
  res.json({ success: true, message: 'Database reset and seeded with default Hospital, Bank, and Service Centre records', ...result });
});

// Toggle ML Service Availability (for demonstration of graceful fallback)
app.post('/api/superadmin/toggle-ml', requireRole('SUPER_ADMIN'), (req, res) => {
  const { available } = req.body;
  mlServiceInstance.setAvailability(available);
  res.json({ mlAvailable: mlServiceInstance.isServiceAvailable });
});

// Random Forest Model Status & Metrics API
app.get('/api/ml/status', (req, res) => {
  try {
    const status = mlServiceInstance.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Random Forest Interactive Simulator API
// e.g. Person 1 takes 3 mins, Person 2 takes 7 mins => Waiting time: 10 mins
app.post('/api/ml/simulate', (req, res) => {
  try {
    const { personDurations = [3, 7], activeCounters = 1 } = req.body;
    const result = mlServiceInstance.simulate({ personDurations, activeCounters });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retrain Random Forest model on demand
app.post('/api/ml/retrain', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), (req, res) => {
  try {
    const success = mlServiceInstance.retrain();
    res.json({ success, status: mlServiceInstance.getStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve client static build if available
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start listening if run directly
if (process.argv[1]?.endsWith('index.js')) {
  app.listen(PORT, () => {
    console.log(`Queueless Backend running on http://localhost:${PORT}`);
  });
}

export default app;
