# Lawyer Involvement

Lawyers can participate at three distinct stages of a deal. Each stage is independent — parties may use any combination (all three, just one, or none).

---

## Overview

```
           ┌──────────────────────────────────────────────────────────────────┐
           │                        DEAL TIMELINE                            │
           │                                                                  │
  DRAFT ───┤  Stage 0         NEGOTIATING ──┤ Stage A       AGREED ──┤ Stage B │
           │  Pre-Vetting                   │ Party Counsel          │ Joint   │
           │  Lawyer invites                │ Each party hires       │ Closing │
           │  client to deal                │ own attorney           │ Counsel │
           └──────────────────────────────────────────────────────────────────┘
```

| Stage | When | Who requests | Attorney role | Independence |
|-------|------|-------------|---------------|--------------|
| **0 — Pre-Vetting** | Before deal creation | Lawyer invites client | Advisory during negotiation | Unilateral |
| **A — Party Counsel** | After party submits selections | Each party independently | Reviews that party's position | Unilateral |
| **B — Joint Closing** | After all clauses agreed | Initiator (other party must acknowledge) | Helps both parties close | Bilateral |

---

## Stage 0 — Pre-Vetting

### What It Is

A lawyer with platform access invites their client to a deal they have pre-configured. The lawyer guides the client through deal creation, sets recommended positions, and monitors the negotiation from the supervisor portal.

### When It Happens

Before the deal is created. The lawyer sets up the deal framework, then sends an invitation to the client.

### How It Works

1. Lawyer creates or configures the deal on the platform
2. Lawyer invites the client via email
3. Client joins and negotiates with the lawyer's guidance
4. Lawyer monitors progress from `/supervise`

### Key Details

| Aspect | Detail |
|--------|--------|
| **Platform field** | `DealRoom.lawyerVettingId` |
| **Visibility** | The other party is unaware of the lawyer's involvement |
| **UI impact** | Deals with a pre-vetting lawyer do **not** show the lawyer warning modal |

---

## Stage A — Party Counsel

### What It Is

After submitting their selections, a party can independently hire an attorney to review their position. This is a private action — the other party is not notified and does not know whether the opposing side has counsel.

### When It Happens

From the moment a party submits their selections. Available during the following party statuses:

- `SUBMITTED` — selections just submitted
- `REVIEWING` — compromise review in progress
- `ACCEPTED` — compromise accepted

### How It Works

1. Party navigates to `/deals/[id]/review`
2. Opens the attorney selection modal
3. Sees a list of available supervisors **filtered by jurisdiction** (only attorneys admitted to the deal's governing law)
4. Selects an attorney — bar number is displayed alongside each name
5. The selected attorney receives an email notification
6. The attorney reviews the party's position via `/supervise`
7. The attorney approves the review
8. The party can proceed

### Jurisdiction Filtering

Attorneys must have a `SupervisorBarAdmission` record matching the deal's `governingLaw` to appear in the selection list. For example:

| Deal governing law | Attorney must be admitted in |
|-------------------|----------------------------|
| CALIFORNIA | California (State Bar) |
| ENGLAND_WALES | England & Wales (SRA) |
| SPAIN | Spain (Colegio de Abogados) |

### Key Details

| Aspect | Detail |
|--------|--------|
| **Platform fields** | `DealRoomParty.attorneyReviewRequested`, `attorneySupervisorId`, `attorneyReviewApprovedAt` |
| **Signing gate** | Pending (unapproved) reviews block signing |
| **Cancellation** | A party can cancel a pending review before it is approved |

### tRPC Procedures

| Router | Procedure | Description |
|--------|-----------|-------------|
| `attorneyReview` | `listAvailableAttorneys` | Jurisdiction-filtered list with conflict-of-interest markers |
| `attorneyReview` | `requestReview` | Assign supervisor + send email |
| `attorneyReview` | `cancelReview` | Cancel pending review |
| `attorneyReview` | `getReviewStatus` | Both parties' review status |

---

## Stage B — Joint Closing Counsel

### What It Is

A neutral attorney who helps both parties finalize the deal after all clauses are agreed. Unlike Stage A (which is private per-party), Stage B is a shared resource visible to both parties.

### When It Happens

Only after all clauses reach `AGREED` status.

### How It Works

1. **Initiator** navigates to `/deals/[id]/review`
2. Clicks "Request Joint Closing Counsel"
3. Sees a list of available supervisors:
   - Filtered by jurisdiction (same as Stage A)
   - **Excludes** any attorney already involved in Stage A for either party (conflict prevention)
4. Selects an attorney
5. Two emails are sent:
   - To the **attorney**: assignment notification
   - To the **other party**: notification to acknowledge or decline
6. **Other party** reviews the request and either:
   - **Acknowledges** — joint counsel proceeds; signing can begin
   - **Declines** — joint counsel is cancelled; signing can begin without counsel

### State Machine

```
                    ┌───────────────┐
                    │  No request   │
                    └───────┬───────┘
                            │ Initiator requests
                            ▼
                    ┌───────────────┐
                    │    Pending    │──── Signing blocked
                    └───────┬───────┘
                   ┌────────┴────────┐
                   │                 │
                   ▼                 ▼
          ┌──────────────┐  ┌──────────────┐
          │ Acknowledged │  │   Declined   │
          │              │  │              │
          │ Joint counsel│  │ No counsel   │
          │ active       │  │ assigned     │
          └──────────────┘  └──────────────┘
                   │                 │
                   └────────┬────────┘
                            ▼
                    Signing unblocked
```

### UI States

| State | Initiator sees | Other party sees |
|-------|---------------|-----------------|
| No request yet | "Request Joint Closing Counsel" button | Nothing |
| Requested, pending | "Pending acknowledgment" status | "Acknowledge / Decline" buttons + waiver text |
| Acknowledged | "Joint counsel active: [Name]" | "Joint counsel active: [Name]" |
| Declined (initiator view) | "Declined by other party" | — |
| Declined (other party view) | — | "You declined joint counsel" |

### Adaptive Waiver Text

When acknowledging joint counsel, each party sees waiver text tailored to their Stage A status:

| Party's Stage A status | Waiver text |
|------------------------|-------------|
| Had separate counsel (Stage A) | "I had separate counsel review my position and consent to joint closing counsel." |
| Declined separate counsel | "I declined separate counsel and consent to joint closing counsel." |

### Key Details

| Aspect | Detail |
|--------|--------|
| **Platform fields** | `DealRoom.jointCounselSupervisorId`, `jointCounselRequestedAt`, `jointCounselRequestedBy`, `jointCounselAcknowledgedAt`, `jointCounselDeclinedAt` |
| **Signing gate** | Pending requests block signing for both parties |
| **Conflict prevention** | Stage A attorneys for either party are excluded from the Stage B candidate list |

### tRPC Procedures

| Router | Procedure | Description |
|--------|-----------|-------------|
| `jointCounsel` | `listAvailable` | Jurisdiction-filtered, Stage A-excluded list |
| `jointCounsel` | `request` | Initiator requests joint counsel |
| `jointCounsel` | `acknowledge` | Other party acknowledges |
| `jointCounsel` | `decline` | Other party declines |
| `jointCounsel` | `getStatus` | Current state + adaptive waiver text |

---

## Lawyer Warning Modal

### Purpose

For deals where no lawyer was involved from the start (no Stage 0 pre-vetting), a one-time warning modal informs the party about the risks of proceeding without legal counsel and summarizes the available lawyer involvement options.

### When It Appears

| Condition | Result |
|-----------|--------|
| Deal has a pre-vetting lawyer (`lawyerVettingId` is set) | Modal is **never** shown |
| Party has already dismissed the modal | Modal is **never** shown |
| Deal status is `DRAFT`, `AWAITING_RESPONSE`, or `NEGOTIATING` | Modal is **shown** |
| Deal status is `AGREED`, `SIGNING`, or `COMPLETED` | Modal is **not** shown |

### Content

The modal displays:

1. **Risk warning** — brief statement about proceeding without legal counsel
2. **Stage timeline** — visual summary of the three lawyer involvement stages:
   - Stage 0 shown as "skipped" (since the deal has no pre-vetting lawyer)
   - Stage A described as available after submission
   - Stage B described as available after agreement

### Dismissal

The "I Understand" button calls `deal.dismissLawyerWarning`, which sets `DealRoomParty.lawyerWarningDismissedAt`. The modal will not appear again for that party on that deal.

### Pages

The modal renders on:
- `/deals/[id]` — deal detail page
- `/deals/[id]/negotiate` — negotiation page

---

## Bar Admissions

### Overview

Supervisors (attorneys) must have bar admissions registered on the platform to appear in attorney selection lists. Bar admissions are jurisdiction-specific and managed by Platform Admins.

### Management

Platform Admins manage bar admissions at `/admin/supervisors`:

1. Each supervisor row shows jurisdiction badges with bar numbers
2. Click `+` to add a new admission (select jurisdiction + enter bar number)
3. Click `×` on a badge to remove an admission

### Schema

```prisma
model SupervisorBarAdmission {
  id             String       @id @default(cuid())
  supervisorId   String
  jurisdiction   GoverningLaw   // CALIFORNIA, ENGLAND_WALES, SPAIN
  barNumber      String

  supervisor Supervisor @relation(...)

  @@unique([supervisorId, jurisdiction])
}
```

### Impact on Attorney Selection

| Stage | Filtering rule |
|-------|---------------|
| **Stage A** | Only supervisors with a bar admission matching the deal's `governingLaw` |
| **Stage B** | Same jurisdiction filter + excludes any Stage A attorneys for either party |

---

## Supervisor Portal View

Supervisors see their assigned deals at `/supervise` and can view deal details at `/supervise/deals/[id]`.

### Stage A Indicators

When a supervisor is assigned as party counsel (Stage A):
- Banner: **"Party Counsel Review Requested"** with party role and timestamp
- After approval: **"Party Counsel Review Approved"** with approval timestamp

### Stage B Indicators

When a supervisor is assigned as joint closing counsel (Stage B):
- Pending banner: **"Joint Closing Counsel — Pending"** with both parties listed, awaiting acknowledgment
- Active banner: **"Joint Closing Counsel — Active"** with both parties listed, acknowledged timestamp

---

## Database Fields Summary

### On `DealRoom`

| Field | Type | Stage | Purpose |
|-------|------|-------|---------|
| `lawyerVettingId` | `String?` | 0 | Pre-vetting lawyer reference |
| `jointCounselSupervisorId` | `String?` | B | Assigned joint counsel |
| `jointCounselRequestedAt` | `DateTime?` | B | When request was made |
| `jointCounselRequestedBy` | `String?` | B | Party ID of initiator |
| `jointCounselAcknowledgedAt` | `DateTime?` | B | When other party acknowledged |
| `jointCounselDeclinedAt` | `DateTime?` | B | When other party declined |

### On `DealRoomParty`

| Field | Type | Stage | Purpose |
|-------|------|-------|---------|
| `attorneyReviewRequested` | `Boolean` | A | Whether party requested review |
| `attorneySupervisorId` | `String?` | A | Assigned party counsel |
| `attorneyReviewApprovedAt` | `DateTime?` | A | When review was approved |
| `lawyerWarningDismissedAt` | `DateTime?` | — | When warning modal was dismissed |

### On `Supervisor`

| Field | Type | Purpose |
|-------|------|---------|
| `barAdmissions` | `SupervisorBarAdmission[]` | Jurisdictions where admitted |
| `jointCounselDeals` | `DealRoom[]` | Deals where assigned as joint counsel |
