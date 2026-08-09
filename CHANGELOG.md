# Changelog

All notable changes to Dealroom are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
pre-1.0, so minor versions may break things.

This file starts at the current state of the project (July 2026); earlier
history was not tracked per-release and lives only in git.

## [Unreleased]

## [0.1.28] — 2026-08-09

### Changed
- **Deal wizard option controls redesigned** for the DPA's wordy choices
  (and any future skill's): options whose labels read as sentences now
  render as the app's selectable cards — left-aligned text with a radio
  circle (single choice) or checkbox square (multi-select) — in a
  responsive grid (one column on mobile, two from small screens up), with
  44 px minimum touch targets. Short option sets keep the compact pills.
- The DPA's sixteen optional questions are grouped under five mini-headings
  (Scope of processing, Sub-processors, Security measures, International
  transfers & TIA, Governing law & forum) via a new optional `group` field
  on parameters — usable by any skill.
- The TIA cross-validation confirmation is a proper tappable control
  instead of a bare checkbox.

## [0.1.27] — 2026-08-09

### Added
- **Agent solo fact intake** (`POST /api/v1/agent/deals`, schema
  `dealroom.solo-intake/1`): create an agreed SOLO deal from a fact
  package — parameters plus clause selections by authored code — and get
  the finished document set back in one call. This is the integration seam
  for suite apps: DPO Central holds the customer's stack knowledge and
  submits facts; Dealroom holds the contract know-how and returns the DPA,
  DOCX/TXT, and the standalone TIA. Invalid or jurisdiction-unavailable
  selections fail loudly with a 422; `Idempotency-Key` makes retries safe;
  `selectionPolicy: "defaults"` fills unspecified clauses with the
  jurisdiction baseline.
- Agent API: `GET /deals/:id/tia` downloads the standalone Transfer Impact
  Assessment (`?whitelabel=1` supported, like the document routes).
- Migration: `AgentDealRoom.initiatorPlaybookId` is now nullable — solo
  fact-intake deals have no playbook.

## [0.1.26] — 2026-08-09

Second law-firm QA pass: every answer is a fact in a shared model, and the
documents draw from it.

### Added
- **Negative-scope drafting:** an optional "expressly out of scope" free-text
  answer renders as its own Annex I section (and flows into SCC Annex I by
  reference) — narrowing what is processed is the strongest safeguard a
  processor can offer.
- **Per-control attribution:** confirmed security measures can be marked as
  inherited from cloud sub-processors; Annex II attributes them explicitly
  and states the validation mechanism (annual review of the provider's audit
  reports) that makes the reliance legitimate. Only measures also confirmed
  count.
- **Breach-history confirmation** joins the TIA's documented facts, and the
  TIA gains an explicit procedural-steps section (EDPB step 6) — the
  often-omitted part recording that the measures need no authority
  authorisation and how contractual measures are implemented.
- **Obligations ledger:** the deal page lists the recurring and event-driven
  duties the agreed document creates (transparency reports, TIA reviews,
  access reviews, breach windows, sub-processor notices…), derived from the
  same fact model the generator uses.
- **White-label output:** `?whitelabel=1` on the PDF and TIA downloads (and a
  "White-label" link) strips platform branding for signature-ready finals —
  substance untouched.
- `check:skills` now fails on known defined terms used without a definition
  and on annex cross-references whose target annex does not exist.

### Fixed
- The SCC citation in the transfer clause now matches Annex III's "mirrored
  for convenience" wording in both languages.
- BAA: forum fill-in placeholder replaced with self-contained wording.

## [0.1.25] — 2026-08-09

### Added
- **Standalone Transfer Impact Assessment export** (`GET /api/deals/[id]/tia`
  + a "TIA" download link on the deal and review pages): produces the DPA's
  Annex IV as its own PDF on demand, with a header identifying the parties
  and the agreement it belongs to — so the assessment can be handed to a
  supervisory authority under Clause 14 of the SCCs without disclosing the
  entire signed contract. 404s cleanly for deals without a TIA annex.

### Removed
- The sibling-document engine design was retracted: interrelated documents
  belong to firm-side tooling, not Dealroom — Dealroom's product is the
  isolated contract with its intertwined annexes.

## [0.1.24] — 2026-08-08

DPA hardening from our own law firm's QA pass over generated wizard output
(16 of 19 checklist items; see `feedback/dpa-wizard-recommendations-2026-08-08.md`).

### Added
- **Government access requests clause** (EDPB Rec. 01/2020 contractual
  supplementary measures: notify + gag-waiver efforts, legality review +
  challenge, minimum disclosure, documentation + aggregate transparency,
  no-back-doors warranty). The TIA's contractual measures now derive from
  this clause being agreed — unbacked checkbox claims are gone.
- **Annex II (TOMs) is now individually confirmable:** a modest, verifiable
  baseline always renders; stronger measures (encryption at rest, MFA +
  quarterly reviews, network security, 12-month logging, backup/DR,
  personnel screening, annual testing) appear only when the user confirms
  their audit evidence supports them. Physical security defaults to the
  provider-managed variant (validated via annual SOC 2/ISO review) — most
  SaaS processors cannot truthfully claim badge readers as their own.
- **TIA answers what it poses:** the wizard asks whether the importer hosts
  customer data (18 U.S.C. § 2711 analysis) and about its government-request
  history, and Annex IV §2 renders documented conclusions.
- Wizard cross-validation: contradictory TIA selections (pseudonymization
  vs identifying categories; EEA residency with a third-country importer)
  must be explicitly confirmed before the deal can be created.
- Sub-processor flow: every authorization option records the initial
  sub-processor list (the sign page warns when it is left blank); general
  authorization lists first as the SaaS default; specific authorization
  gained reminder → deemed-approval → escalation mechanics.
- Deletion clause option for immutable backups (deemed deletion on rotation,
  180-day outer limit); breach clause risk-allocation sentence (processor's
  notice unconditional on internal triage); audit clause ordinary-course
  limb (SOC 2/ISO reports satisfy Art. 28(3)(h)).

### Fixed
- Custom governing law now feeds the cover page and every occurrence from
  one variable — cover and body can no longer name different states.
- "Principal Agreement" is defined (and the BAA defines and cross-references
  its "Underlying Agreement"); mirrored precedence carve-outs for PHI/
  coexisting agreements on both documents.
- Login emails never render as party or signatory names.
- Annex list markers and subheads no longer orphan at page breaks; accented
  Spanish annex subheads style correctly.
- SCC citation wording signals the todo.law mirror is deliberate.

## [0.1.23] — 2026-08-08

### Fixed
- Self-host marketplace catalog snapshot regenerated from the storefront:
  adds the residential-tenancy family and BAA Negotiator, drops
  dpia-companion and vendor-risk (DPO Central skills that briefly rode the
  Dealroom catalog). The stub seeder now also prunes catalog-only stubs
  whose skill has left the catalog, so existing self-host installs clean
  themselves up on next boot.

## [0.1.22] — 2026-08-08

### Added
- **DPA:** UK Addendum incorporated by reference — Annex III §6 now
  incorporates the ICO's International Data Transfer Addendum (version B1.0)
  for transfers subject to the UK GDPR, with its Part 1 tables completed by
  cross-reference to the DPA (on by default; switch to No to fall back to
  the "execute separately" notice). §7 adds Swiss FADP adaptations
  (FDPIC as supervisory authority, Swiss data subjects' rights preserved),
  also on by default. Both sections apply only to the extent such transfers
  exist, so they are inert in purely EU-facing DPAs.
- **MSA / NDA / SaaS:** the "Custom governing law and courts" option now
  exists on the Dispute resolution clause of all three skills, with the two
  open fields at the end of deal details — the DPA feature generalized.
- Sign page warns before signing when the agreed terms still contain
  unfilled fill-in blanks (e.g. the custom law option chosen without its
  fields), listing the missing fields.
- E2E regression spec for the DPA transfers wizard (TIA default on,
  localized establishment labels, custom-law fields present).

### Fixed
- Deal wizard: single-choice parameters now render their localized option
  labels instead of raw values ("United States" instead of "US",
  "Yes — attach as Annex IV" instead of "yes").
- `check:skills` now scopes to seedable skills (dirs with `clauses.json`),
  matching the seeder — catalog-only document skills are no longer flagged.
- Cross-logout also clears DPO Central's new app-prefixed session cookies.

## [0.1.21] — 2026-08-08

### Added
- **DPA:** the Transfer Impact Assessment (Annex IV) is now attached by
  default for processors established outside the EEA — Clause 14 of the
  Standard Contractual Clauses requires the assessment, so it is no longer
  opt-in (still switchable to No). Schema defaults now also apply to deals
  created without the parameter (e.g. via the Agent API).
- **DPA:** new "Custom governing law and courts" option on the governing-law
  clause, plus two open fields at the end of deal details — keep the
  GDPR/ICO-inspired DPA body under the law and courts your business knows
  (e.g. a US company under Delaware law and New York courts). The mandatory
  EU governing-law election for the SCCs in Annex III is expressly preserved.

### Fixed
- All 6 open Dependabot alerts resolved via lockfile-only transitive bumps:
  nanoid 3.3.18/5.1.16, undici 6.28.0, js-yaml 4.3.1.
- Published images now build from the Dockerfile's digest-pinned
  `node:22-alpine` (the publish workflow previously overrode it).

## [0.1.20] — 2026-08-08

### Changed
- Release images build on native GitHub runners (amd64 + arm64 matrix,
  digest push + manifest merge) — QEMU emulation dropped after repeated
  arm64 `npm ci` stalls.
- Dedicated slim migrator image stage: ~373 MB (101 MB compressed), down
  from the ~1.8 GB builder stage; stable-first layers so updates re-download
  ~1.5 MB. Entrypoint contract unchanged.

## [0.1.19] — 2026-08-08

### Fixed
- **Self-host:** suite apps no longer clobber each other's sessions when
  running on localhost with a shared NextAuth secret — Dealroom's session
  cookie is now app-prefixed and the session re-anchors on the user's email.

## [0.1.18] — 2026-08-07

### Added
- **DPA international transfers:** the DPA asks where the Processor is
  established; US / other third countries add Annex III incorporating the
  EU Standard Contractual Clauses (Implementing Decision (EU) 2021/914,
  Module Two) by reference, with completed elections and appendices.
  Optional Data Privacy Framework handling (adequacy-primary with SCC
  fallback) and an optional Transfer Impact Assessment annex following EDPB
  Recommendations 01/2020 (US legal analysis, 12 supplementary-measure
  options, honest residual-risk conclusion when no technical measure is
  selected).
- Boilerplate annexes support `showIf` conditions on deal parameters.

## [0.1.17] — 2026-08-05

### Added
- Deal history timeline on the deal page, derived from the audit log.
- Signing-stall warning and manual reminder on the sign page (72 h cooldown,
  EN/ES).
- Local Docker Postgres for development (`docker-compose.dev.yml`) — dev no
  longer touches production data.

## [0.1.16] — 2026-08-05

### Added
- Solo-first self-host: local-auth posture defaults every journey to SOLO
  deal mode (wizard, express presets, Agent API).
- `/marketplace` re-enabled for both postures: hosted shows in-app checkout,
  self-host deep-links to the todo.law storefront; catalog stubs populate
  the self-host grid (with a guard that refuses to seed stubs into a hosted
  database).
- Authored clause biases for NDA/MSA/SaaS; statutory citations printed under
  standard clauses.

### Fixed
- Compromise engine: party-B satisfaction sign error corrected.
- Skills loader/validator: localisation decoupled from option layout;
  single-option clauses accepted.
- Sovereign images no longer bake the expired all-skills-free promo flag.

## [0.1.15] — 2026-08-02

### Fixed
- Dependabot criticals/highs resolved; lockfile regenerated with npm 10 to
  match CI (local npm 11 lockfiles broke `npm ci` on the runners).

## [0.1.2 – 0.1.14] — July 2026 (summarized)

The self-host maturation arc, released as fourteen small tags: skip the
marketing landing and default to solo mode on self-host, premium skills
surfaced as marketplace items with `.skill` installer fixes, AI posture
picker (Off / Cloud LLM / Local gateway), express-setup presets (3-click
deal creation), bundled hosted-skills for self-host installs, and the
governance/hardening batch below.

### Added
- Governance set: `SECURITY.md`, `CONTRIBUTING.md`, `NOTICES.md`, this
  changelog; AGPL §13 "Source code" offer rendered in the app footers
  (configurable via `NEXT_PUBLIC_SOURCE_URL`).
- `check:skills` now scans clause legal text for leaked bracket
  placeholders (undeclared ALL-CAPS / Title-Case tokens) in addition to
  boilerplate.
- Skills drift detection: checksum manifest tooling and
  `docs/skills-sync.md` for comparing baked `skills/` against the upstream
  `legalskills` catalog.
- First test coverage for tRPC router scoping, admin/supervisor 2FA
  verification, and licensing entitlement checks.
- Sovereign kit: app container healthcheck wired to `/api/health`,
  digest-pinned base images, resource limits, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  threaded as a build arg (Google sign-in previously shipped broken in the
  image), migrator P3005 self-heal/atomic baseline.

### Fixed
- **Security:** admin and supervisor 2FA verify endpoints now require
  server-side TOTP code verification before setting the gate cookie
  (previously any holder of a valid session could obtain the second-factor
  cookie without a code).
- Delaware Certificate of Incorporation skill re-tagged `DELAWARE`
  (was mis-tagged `CALIFORNIA`); jurisdiction tags now map explicitly onto
  the deal engine's governing-law enum.
- MSA `[NAMED COMPETITORS]` placeholder normalized to the lower-case
  fill-in convention (EN/ES) so unfilled optional tokens read as drafting
  blanks.

### Removed
- Payments removed from the hosted deployment during the free-trial window
  (note: reversed on 2026-07-17 — the hosted paywall is live again; with
  Stripe unset, self-host keeps all skills free).
- Real personal data and live credentials from seeds, docs, and tracked
  internal audit files (replaced with fictional fixtures).

## [0.1.0] — baseline, 2026-07

Initial public baseline. Highlights of what exists at this point:

- Two-party async contract negotiation with weighted compromise engine
  (firmness × option bias, global fairness pass) and solo mode.
- Six baked skills (NDA, MSA, DPA, SaaS, Privacy Notice, Delaware
  Certificate of Incorporation) with near-complete EN/ES bilingual parity;
  skills marketplace with Ed25519-signed packages and offline licensing.
- Document generation (DOCX/PDF), type-to-sign signing flow with expiry
  cron, supervisor and platform-admin portals with TOTP 2FA.
- Agent Negotiation REST API + A2A skill catalog; `/api/health` probe.
- Sovereign self-host kit (`deploy/sovereign/`): Docker Compose, migrator,
  backup/restore, optional Caddy TLS, port 8486.
