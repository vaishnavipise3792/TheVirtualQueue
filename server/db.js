import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_FILE = path.join(DB_DIR, 'queueless.db');
export const db = new DatabaseSync(DB_FILE);

// Enable WAL mode and foreign keys for high concurrency & integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('HOSPITAL', 'BANK', 'SERVICE_CENTRE')),
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      grace_period_mins INTEGER NOT NULL DEFAULT 5,
      notification_threshold INTEGER NOT NULL DEFAULT 2,
      avg_service_mins REAL NOT NULL DEFAULT 10.0,
      priority_levels_json TEXT NOT NULL,
      optional_fields_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS counters (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      name TEXT NOT NULL,
      current_staff_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_counters (
      service_id TEXT NOT NULL,
      counter_id TEXT NOT NULL,
      PRIMARY KEY (service_id, counter_id),
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY(counter_id) REFERENCES counters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_sequences (
      service_id TEXT NOT NULL,
      date_kolkata TEXT NOT NULL,
      current_seq INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (service_id, date_kolkata),
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS queue_entries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      token_number TEXT NOT NULL,
      tracking_code TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      priority_level TEXT NOT NULL,
      priority_weight INTEGER NOT NULL DEFAULT 10,
      custom_fields_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL CHECK(status IN ('WAITING', 'CALLED', 'IN_SERVICE', 'COMPLETED', 'SKIPPED', 'CANCELLED', 'NO_SHOW')),
      assigned_counter_id TEXT,
      called_by_staff_id TEXT,
      joined_at TEXT NOT NULL,
      called_at TEXT,
      service_started_at TEXT,
      completed_at TEXT,
      requeue_count INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL CHECK(source IN ('ONLINE', 'WALK_IN')),
      notification_sent INTEGER NOT NULL DEFAULT 0,
      date_kolkata TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_queue_org_service_status 
      ON queue_entries(organization_id, service_id, status);

    CREATE INDEX IF NOT EXISTS idx_queue_tracking_code 
      ON queue_entries(tracking_code);

    CREATE TABLE IF NOT EXISTS staff_users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'ORG_ADMIN', 'STAFF', 'FRONT_DESK')),
      assigned_counter_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      actor_role TEXT,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_audit_org 
      ON audit_logs(organization_id, created_at);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      queue_entry_id TEXT NOT NULL,
      token_number TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SIMULATED',
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_reviews (
      id TEXT PRIMARY KEY,
      queue_entry_id TEXT NOT NULL UNIQUE,
      organization_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      tracking_code TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
      feedback_text TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(queue_entry_id) REFERENCES queue_entries(id) ON DELETE CASCADE,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_org
      ON customer_reviews(organization_id);

    CREATE INDEX IF NOT EXISTS idx_reviews_service
      ON customer_reviews(service_id);
  `);
}

// Utility to get current Kolkata date (YYYY-MM-DD)
export function getKolkataDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

// Utility for current UTC ISO string
export function getUtcIso(date = new Date()) {
  return date.toISOString();
}
