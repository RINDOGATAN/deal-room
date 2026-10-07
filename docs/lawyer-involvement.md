# Lawyer Involvement

Lawyers can participate at three distinct stages of a deal. Each stage is independent — parties may use any combination (all three, just one, or none).

**Own lawyer only (owner's decision, 6 October 2026).** Dealroom keeps no list of lawyers for parties and states no fee for legal review. A technology company that lists lawyers and states their fee looks like a lawyer referral service, which Dealroom does not run (US) and which European bars restrict. A party always brings its own lawyer: in Stage A it invites one by e-mail, in Stage B the initiator names one by e-mail. The lawyer works for the client and bills the client directly; Dealroom takes no fee and makes no recommendation. The in-app invitation works whatever the `startupCoverage` feature flag says (the flag gates only the agent tools and discovery).

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

After submitting their selections, a party can invite its own lawyer, by e-mail, to review its position. This is a private action — the other party is not notified and does not know whether the opposing side has counsel.

### When It Happens

From the moment a party submits their selections. Available during the following party statuses:

- `SUBMITTED` — selections just submitted
- `REVIEWING` — compromise review in progress
- `ACCEPTED` — compromise accepted

### How It Works

1. Party navigates to `/deals/[id]/review`
2. Clicks "Invite your own lawyer"
3. Enters the lawyer's e-mail (and, optionally, name). The dialog says: "The lawyer you invite works for you and bills you directly; Dealroom takes no fee and makes no recommendation."
4. The lawyer becomes a supervisor of this one deal (an existing account is reused; a new one has no bar admission) and receives an e-mail with a link to the review portal
5. The lawyer signs in to `/supervise` with that address (two-factor authentication is set up on first sign-in) and reviews the party's position
6. The lawyer approves the review
7. The party can proceed

There is no list of lawyers and no jurisdiction filter: the party chooses its lawyer. Guards: the other party's address is refused; a lawyer already reviewing for the other party is refused; a deactivated account cannot be invited; five invitations per deal per 24 hours. The same invitation is available to agents (`share_with_attorney`, `POST /api/v1/agent/deals/{id}/attorney`) while `startupCoverage` is on.

### Key Details

| Aspect | Detail |
|--------|--------|
| **Platform fields** | `DealRoomParty.attorneyReviewRequested`, `attorneySupervisorId`, `attorneyReviewApprovedAt` |
| **Signing gate** | Pending (unapproved) reviews block signing |
| **Cancellation** | A party can cancel a pending review before it is approved |

### tRPC Procedures

| Router | Procedure | Description |
|--------|-----------|-------------|
| `attorneyReview` | `inviteOwnLawyer` | Invite a lawyer of the party's choice by e-mail (open the review + send email) |
| `attorneyReview` | `cancelReview` | Cancel pending review |
| `attorneyReview` | `getReviewStatus` | Both parties' review status |

---

## Stage B — Joint Closing Counsel

### What It Is

A lawyer named by the initiator, by e-mail, who helps both parties finalize the deal after all clauses are agreed. Unlike Stage A (which is private per-party), Stage B is a shared resource visible to both parties.

### When It Happens

Only after all clauses reach `AGREED` status.

### How It Works

1. **Initiator** navigates to `/deals/[id]/review`
2. Clicks "Request Joint Closing Counsel"
3. Enters the lawyer's e-mail (and, optionally, name). The dialog says: "The lawyer you name works for both parties and bills them directly; Dealroom takes no fee and makes no recommendation."
   - A party's own address is refused
   - A lawyer already involved in Stage A for either party is refused (conflict prevention)
4. Two emails are sent:
   - To the **lawyer**: an invitation to the review portal
   - To the **other party**: notification to acknowledge or decline
5. **Other party** reviews the request and either:
   - **Acknowledges** — joint counsel proceeds; signing can begin
   - **Declines** — joint counsel is cancelled; signing can begin without counsel

One request per deal: after a decline, the parties sign without joint counsel.

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
| **Conflict prevention** | A Stage A lawyer for either party cannot be named as joint counsel |

### tRPC Procedures

| Router | Procedure | Description |
|--------|-----------|-------------|
| `jointCounsel` | `request` | Initiator names joint counsel by e-mail |
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
   - Stage A described as available after submission (invite your own lawyer)
   - Stage B described as available after agreement (the initiator names a shared lawyer by e-mail)

### Dismissal

The "I Understand" button calls `deal.dismissLawyerWarning`, which sets `DealRoomParty.lawyerWarningDismissedAt`. The modal will not appear again for that party on that deal.

### Pages

The modal renders on:
- `/deals/[id]` — deal detail page
- `/deals/[id]/negotiate` — negotiation page

---

## Bar Admissions

### Overview

Platform Admins can record bar admissions for supervisors (attorneys). Since 6 October 2026 they no longer drive any list shown to parties, which choose their own lawyers; they remain as admin records and for admin assignment.

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

None for parties: there is no attorney selection list (owner's decision, 6 October 2026). Existing supervisors and their bar admissions are kept intact and stay visible in the admin views.

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
