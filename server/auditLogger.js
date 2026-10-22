import { db, getUtcIso } from './db.js';
import crypto from 'node:crypto';

export function logAudit({
  organizationId,
  action,
  entityType,
  entityId,
  actorId = 'system',
  actorName = 'System',
  actorRole = 'SYSTEM',
  details = {}
}) {
  const id = 'aud_' + crypto.randomBytes(8).toString('hex');
  const createdAt = getUtcIso();
  const detailsJson = JSON.stringify(details);

  const stmt = db.prepare(`
    INSERT INTO audit_logs (
      id, organization_id, action, entity_type, entity_id,
      actor_id, actor_name, actor_role, details_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    organizationId,
    action,
    entityType,
    entityId,
    actorId,
    actorName,
    actorRole,
    detailsJson,
    createdAt
  );

  return { id, createdAt };
}

export function getAuditLogs(organizationId, limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE organization_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  const rows = stmt.all(organizationId, limit);
  return rows.map(r => ({
    ...r,
    details: JSON.parse(r.details_json || '{}')
  }));
}
