import { db, getUtcIso } from './db.js';
import crypto from 'node:crypto';

/**
 * NotificationProvider Interface
 */
export class NotificationProvider {
  async sendNotification({ organizationId, queueEntryId, tokenNumber, recipientPhone, message }) {
    throw new Error('sendNotification must be implemented by concrete provider');
  }
}

/**
 * MockNotificationProvider (v1 MVP)
 * Logs and stores notifications safely without external network calls
 */
export class MockNotificationProvider extends NotificationProvider {
  constructor() {
    super();
    this.memoryLog = [];
  }

  async sendNotification({ organizationId, queueEntryId, tokenNumber, recipientPhone, message }) {
    const id = 'notif_' + crypto.randomBytes(8).toString('hex');
    const createdAt = getUtcIso();

    // Store in DB for customer and admin inspection
    const stmt = db.prepare(`
      INSERT INTO notifications (
        id, organization_id, queue_entry_id, token_number, recipient_phone, message, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'SIMULATED', ?)
    `);
    stmt.run(id, organizationId, queueEntryId, tokenNumber, recipientPhone, message, createdAt);

    const record = {
      id,
      organizationId,
      queueEntryId,
      tokenNumber,
      recipientPhone,
      message,
      status: 'SIMULATED',
      createdAt
    };

    this.memoryLog.unshift(record);
    if (this.memoryLog.length > 200) this.memoryLog.pop();

    console.log(`[MOCK NOTIFICATION] To: ${recipientPhone} | Token: ${tokenNumber} | "${message}"`);
    return record;
  }

  getRecentNotifications(organizationId, limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM notifications 
      WHERE organization_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(organizationId, limit);
  }
}

export const activeNotificationProvider = new MockNotificationProvider();

/**
 * Check if "almost your turn" alert should trigger and send it
 */
export async function triggerAlmostTurnNotification({ queueEntry, remainingAhead, service }) {
  if (!queueEntry || queueEntry.notification_sent === 1) return null;

  const threshold = service.notification_threshold || 2;
  if (remainingAhead <= threshold && remainingAhead >= 0) {
    // Mask phone for logging
    const maskedPhone = queueEntry.customer_phone.replace(/(\d{2})\d+(\d{2})/, '$1******$2');
    const message = `🔔 Queueless Alert: Token ${queueEntry.token_number} for ${service.name}. You are almost up! Only ${remainingAhead} ${remainingAhead === 1 ? 'person is' : 'people are'} ahead of you. Please head toward the waiting area.`;

    const result = await activeNotificationProvider.sendNotification({
      organizationId: queueEntry.organization_id,
      queueEntryId: queueEntry.id,
      tokenNumber: queueEntry.token_number,
      recipientPhone: queueEntry.customer_phone,
      message
    });

    // Mark as sent so we don't spam
    db.prepare(`UPDATE queue_entries SET notification_sent = 1 WHERE id = ?`).run(queueEntry.id);
    return result;
  }
  return null;
}
