# Capacity

What one Dealroom instance can carry, what fails first, and how the hosted
service scales. Written on 2026-09-14 from the code, the compose file and the
hosting configuration. No load test has been run yet, so request-rate figures
are marked "unknown, to measure" rather than guessed.

## What the instance holds in memory

Almost nothing, which is what makes horizontal scaling possible:

- **Sessions** are NextAuth JWTs, so no session table is read per request.
- **Rate limits and idempotency keys** are database rows (`rate_limit_counters`,
  `idempotency_records`), shared across instances and restarts.
- **Per-process state** is limited to the Prisma client, the Stripe client and
  the Next.js build cache. None of it carries user data.
- **One exception, self-host only:** `.skill` files installed on `/skills` are
  written to `INSTALLED_SKILLS_DIR` on the container's volume. Two app replicas
  would need that volume shared. Hosted does not use the installer (it is off
  whenever Stripe is on).

## Per-instance ceiling

| Dimension | Self-hosted (suite defaults) | Hosted (Vercel + Neon) | Reasoning |
|---|---|---|---|
| Resources | App 2 CPU / 2 GB; Postgres 1 CPU / 1 GB; migrator 1 CPU / 1 GB (`deploy/sovereign/docker-compose.yml`) | Vercel Pro functions (60 s limit, noted in `src/lib/prisma.ts`); Neon autoscaling 0.5 to 2 CU, suspend disabled | Configuration as committed or recorded |
| Organisations | Built for one firm | No code limit | Every query is scoped by user and deal; there is no tenant partition to exhaust |
| Users | Tens (one firm on a private network) | No code limit; unknown, to measure | Users cost a row each; the practical limit is concurrent activity, below |
| Documents (deals) | Hundreds of thousands before storage matters (estimate) | Same, bounded by Neon storage | A deal is one row plus about 10 to 20 clause rows, selections, messages and audit rows: kilobytes, not megabytes. Contract PDFs are rendered on demand and not stored |
| Requests per minute, ordinary pages and tRPC | Unknown, to measure | Unknown, to measure | Each request is a JWT check plus a few indexed queries; no measurement exists |
| PDF and DOCX exports at the same time | About 2 at once without slowing other users (estimate) | One per function instance; Vercel adds instances | `@react-pdf/renderer` renders synchronously on the CPU. On a 2-CPU single Node process a render blocks that process's event loop for its duration (unknown, to measure; a multi-page DPA with annexes is the worst case) |
| Sign-in attempts | 20 per 15 minutes per client address | Same | `PUBLIC_LIMITS` in `src/server/middleware/public-rate-limit.ts` |
| Magic-link e-mails | 5 per hour per client address | Same | Same file |
| Agent API | Per key and per A2A skill, as documented in `docs/agent-api.md` | Same | `apiKeyAuth.ts` |
| `/api/health` | 60 per minute per client address | Same | Same file |

## What breaks first

1. **Shared office addresses against the sign-in limits (hosted).** The limits
   are keyed on the client address. A firm whose staff all leave through one
   public address shares a single bucket: the sixth magic-link request from that
   office within an hour receives HTTP 429. This will be felt before any
   resource limit. The remedy is to key magic links on the e-mail address as
   well as the address, with a higher per-address ceiling.
2. **PDF rendering on self-host.** Exports run on the same event loop as every
   other request, so several simultaneous exports make the whole app slow for
   their duration. Remedy: render in a worker thread or a separate process.
3. **Database connections on hosted.** Each Vercel function instance opens its
   own Prisma pool (default size: twice the CPU count plus one, unless the
   connection URL sets `connection_limit`). A burst that scales functions widely
   multiplies connections. The app uses Neon's pooled URL, which absorbs this;
   the pool size behind it depends on the compute size (unknown, to measure on
   the production plan). The retry wrapper in `src/lib/prisma.ts` treats "Too
   many connections" as retryable, so the symptom is slower responses, then 503.
4. **Neon compute at 2 CU.** Autoscaling stops at 2 CU. Heavy concurrent writes
   (deal creation seeds many clause rows in one transaction) will hit this
   before storage. Unknown, to measure.
5. **The rate-limit table itself.** Every limited request writes a counter row.
   Expired rows are purged once a day by `/api/cron/daily`; if the cron stops,
   the table grows by roughly one row per client per minute of health polling.

## Hosted scaling plan

- **Database tier:** raise the Neon autoscaling ceiling above 2 CU when
  sustained CPU approaches it; add a read replica for analytics and admin reads
  if those grow. Storage is not the constraint (see documents row above).
- **Pooling:** keep the app on the pooled Neon URL and set an explicit small
  `connection_limit` in it (for example 3 to 5) so function fan-out cannot
  exhaust the pool; migrations and seeds stay on the direct URL.
- **Storage:** contract documents are rendered on demand and not stored, so
  there is no object storage to scale for them. Skill packages are served from
  the blob store.
- **Per-process state:** already replaced. Rate limits and idempotency moved to
  the database; sessions are JWTs. If the database counter becomes a write
  bottleneck, move limits to a shared key-value store (for example Redis) behind
  the same `claimSlot` function.
- **PDF rendering:** if exports dominate function time, move rendering to a
  dedicated function or background job and cache the output per agreed deal
  version.

## How to fill the unknowns

Run a load test against a Vercel preview wired to a Neon branch (never the
production database) and against the suite on a 2-CPU machine: ramp a mix of
deal page loads, clause selections and PDF exports until p95 latency passes
2 seconds, and record the requests per minute and the connection count at that
point in this file.
