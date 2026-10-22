# Queueless – Product Requirements Document

*Multi-sector virtual queue platform for Hospitals, Banks and Service Centres · Version 1.0 (draft) · October 2026*

## 1. Overview

Queueless replaces physical waiting lines with a virtual queue. Customers join a queue from their phone or are registered by front-desk staff, then track their position and estimated wait without standing in line. Staff call tokens from a console, and a waiting-area display board shows who is being served and where.

The platform is built as **one generic queue engine**. Hospital, Bank and Service Centre are *organization types* that configure the engine (labels, priority rules, optional fields); they are not separate code paths.

## 2. Problem Statement

- Customers spend long, uncertain periods in crowded waiting areas with no visibility into when they will be served.
- Front desks and counters manage queues with paper slips or ad hoc tools, causing disputes about order, lost tokens and unfair handling of priority cases.
- Organizations have no data on wait times, no-show rates or counter utilization.

## 3. Goals and Non-Goals

### Goals

1. One configurable queue engine serving three sector types with no sector-specific code branches.
2. Multi-tenant from day one: every tenant-owned record is scoped by `organization_id`.
3. Transparent waiting: customers see token, position, estimated wait and assigned counter.
4. Fair and auditable ordering: priority, then join time, with every priority change logged.
5. Minimal personal data collection and privacy-safe public views.

### Non-Goals (v1)

- Real SMS/WhatsApp/push delivery (a mock provider ships in v1).
- Appointment booking and scheduling.
- Payments, billing or subscription management.
- Native mobile apps (responsive web only).
- Cross-organization analytics for customers.

## 4. Target Users and Personas

| Persona | Description | Primary need |
| --- | --- | --- |
| Customer / Patient | Visits a hospital, bank or service centre | Know when to show up; avoid standing in line |
| Front-desk operator | Registers walk-ins | Fast registration, hand over a token |
| Counter staff | Serves the queue | Call next, skip, complete, re-queue |
| Organization admin | Manages one organization | Configure branches, services, users, rules |
| Platform super admin | Operates the platform | Onboard organizations, monitor health |

## 5. Domain Model

Every tenant-owned table carries `organization_id`, and every query is scoped by the authenticated user's organization.

| Entity | Purpose |
| --- | --- |
| Organization | Tenant. Has a `type`: HOSPITAL, BANK or SERVICE\_CENTRE |
| Branch | Physical location of an organization (table exists in v1 even if the UI exposes a single branch) |
| Service | A queue under a branch, e.g. Cardiology OPD, Cash Deposit, Passport Renewal. Holds service code, grace period, optional field config |
| Counter | Counter or room that serves a service, e.g. "Counter 4" |
| QueueEntry | One customer's place in a service queue for a day |
| StaffUser | Authenticated user with a role |
| AuditLog | Immutable record of sensitive actions (priority changes, status overrides, user changes) |

## 6. Functional Requirements

### 6.1 Customer experience

- **FR-1 Landing flow.** Customer chooses type (Hospital / Bank / Service Centre), then organization, then service.
- **FR-2 Join online.** Customer provides name, phone and service (plus any optional fields configured for that service) and receives a token and tracking link.
- **FR-3 Walk-in registration.** Front-desk staff register a customer for a service and issue a token.
- **FR-4 Tracking page** at `/track/{code}`: token, position, estimated wait, assigned counter and status. The code is unguessable. Names are never shown publicly.
- **FR-5 Almost-your-turn alert** when N tokens remain ahead of the customer, sent through a `NotificationProvider` interface (mock implementation in v1).
- **FR-6 Cancel.** Customer can leave the queue from the tracking page, moving the entry to CANCELLED.
- **FR-7 Display board** at `/display/{serviceId}`: shows tokens currently being called with their counters and the next few waiting tokens. No personal data.

### 6.2 Queue engine

- **FR-8 Token format.** `<SERVICE_CODE>-<3-digit sequence>`, e.g. CAR-014, DEP-007. Sequence is per service per day and resets at midnight Asia/Kolkata. Generated inside a transaction with a locked counter row to prevent duplicates under concurrency.
- **FR-9 Ordering.** Entries are ordered by priority level, then by join time. Priority levels are configurable per organization (default: PRIORITY > NORMAL).
- **FR-10 Priority changes** are permitted only to authorized roles and every change is written to the AuditLog.
- **FR-11 Status lifecycle.** WAITING → CALLED → IN\_SERVICE → COMPLETED. Terminal or side states: SKIPPED, CANCELLED, NO\_SHOW. Invalid transitions return HTTP 409.
- **FR-12 No-show handling.** After a CALLED token is not acknowledged within the service's grace period (default 5 minutes, configurable per service), it becomes NO\_SHOW. Staff may re-queue a no-show once.
- **FR-13 Estimated wait.** Computed per service by an ML model, with a heuristic fallback (e.g. rolling average service time × position ahead ÷ active counters) when data is insufficient or the model is unavailable.

### 6.3 Staff and admin

- **FR-14 Roles.**
  - SUPER\_ADMIN: platform-level; manages organizations.
  - ORG\_ADMIN: manages own organization's branches, services, counters, users and configuration.
  - STAFF: operates assigned queues (call next, skip, start, complete, re-queue).
  - FRONT\_DESK: registers walk-ins and views queues read-only.
- **FR-15 Staff console.** Shows the current queue for assigned service(s), with call-next, recall, skip, start service, complete and re-queue actions.
- **FR-16 Configuration.** ORG\_ADMIN can configure per-service code, grace period, notification threshold N, priority labels and optional fields.
- **FR-17 Audit log viewer** for ORG\_ADMIN, scoped to the organization.

## 7. Sector Configuration (not hardcoded)

| Capability | Hospital | Bank | Service Centre |
| --- | --- | --- | --- |
| Priority labels (examples) | Emergency, Senior citizen, Normal | Premium, Senior citizen, Normal | Senior citizen, Normal |
| Optional fields (examples) | Reason for visit | Account type | Document type |
| Example services | Cardiology OPD, Pharmacy | Cash Deposit, Loan Enquiry | Passport Renewal, Licence |
| Average service time | Per service | Per service | Per service |

Priority labels, rules and optional fields are stored as per-organization and per-service configuration, not as columns or code branches.

## 8. Non-Functional Requirements

- **Multi-tenancy and isolation.** All queries scoped by `organization_id` derived from the authenticated session, never from client input. Cross-tenant access attempts return 404/403 and are tested.
- **Privacy.** Collect minimum data (name, phone, service, configured optional fields). No sensitive details beyond what a service explicitly configures. No personal data in application logs. Public pages never show names.
- **Security.** Unguessable tracking codes (high-entropy, non-sequential). Role-based access control on every endpoint. Rate limiting on public join and tracking endpoints. Standard protections against injection and CSRF.
- **Concurrency and correctness.** Token generation and status transitions are transactional and safe under simultaneous staff actions.
- **Performance.** Queue state and display board updates reach clients within 2 seconds of a change (websocket or short polling). Public pages usable on low-bandwidth mobile connections.
- **Availability.** Target 99.5% during organizations' operating hours; graceful degradation to the heuristic wait estimate if the ML service is down.
- **Time handling.** Store UTC; day boundaries and token resets evaluated in Asia/Kolkata.
- **Accessibility and localization.** Responsive, keyboard-accessible UI; text externalized to allow Hindi and Marathi in a later release.

## 9. Integrations and Interfaces

- **NotificationProvider** interface with a mock implementation in v1 (logs/stores messages without sending). Real SMS/WhatsApp providers can plug in later without engine changes.
- **ML wait-time service** behind an internal interface, trained per service on historical service durations, with the heuristic fallback always available.

## 10. Success Metrics

| Metric | Target (pilot) |
| --- | --- |
| Median estimated vs. actual wait error | Within 20% after 2 weeks of data per service |
| Customers using tracking link | > 60% of issued tokens |
| No-show rate | Tracked per service; reduced vs. baseline |
| Staff actions per token (clicks) | ≤ 3 for the standard flow |
| Cross-tenant data leakage incidents | 0 |

## 11. Release Plan

- **v1 (MVP):** multi-tenant engine, landing flow, online join, walk-in registration, staff console, tracking page, display board, priority, no-show handling, heuristic wait estimate, mock notifications, audit log.
- **v1.1:** ML wait-time model per service, admin analytics dashboard, QR codes on tracking page.
- **v2:** real notification providers, multi-branch UI, localization, appointment hybrid mode.

## 12. Risks and Open Questions

| Risk / question | Mitigation or decision needed |
| --- | --- |
| Multi-tenant leakage through a missed scope | Central query scoping, automated cross-tenant tests |
| Insufficient data for ML in early weeks | Heuristic fallback from day one |
| Customers without smartphones | Front-desk registration plus display board and printed token slips |
| Medical and financial data sensitivity | Minimal collection; legal review before pilot with hospitals or banks |
| Open: onboarding model for organizations | Self-serve vs. super-admin-created only |
| Open: tracking code lifetime | Expire at end of day vs. retain for audit |
| Open: phone verification (OTP) for online joins | Needed to prevent abuse, but depends on SMS provider |

## 13. Acceptance Criteria (summary)

1. Two organizations can run simultaneously with no data visible across tenants.
2. Concurrent joins to the same service never produce duplicate tokens.
3. Invalid status transitions return 409 and leave state unchanged.
4. A priority entry is called before a normal entry that joined earlier, and the change is audit-logged.
5. The tracking page and display board show no customer names.
6. A CALLED token not acknowledged within the grace period becomes NO\_SHOW and can be re-queued exactly once.
