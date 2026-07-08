// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Firmas signing-callback receiver.
 *
 * Counterpart to `signing.sendToFirmas` (tRPC) and the
 * `/sign/[token]` page on www.firmas.io. After the respondent has
 * signed inside Firmas, the wallet POSTs back a `SignedReceipt`:
 *
 *   {
 *     token: <firmasToken>,
 *     identityCredential: <SD-JWT VC compact string>,
 *     contractHash: <hex SHA-256>,
 *     signatureBase64url: <base64url ECDSA P-256 over contractHash>,
 *     signedAt: <epoch seconds>
 *   }
 *
 * We:
 *   1. Look up the SigningRequest by firmasToken.
 *   2. Verify the identityCredential is a valid SD-JWT VC issued by
 *      https://www.firmas.io (the Firmas issuer is on Dealroom's
 *      trusted-issuer allowlist — same posture Firmas itself uses for
 *      external credential verification).
 *   3. Confirm the contractHash matches the documentHash we recorded
 *      at signing.initiate time.
 *   4. Verify the ECDSA P-256 signature over the contractHash against
 *      the holder key embedded in the SD-JWT VC's `cnf.jwk`.
 *   5. Persist the bundle, mark `respondentSignedAt`, transition the
 *      DealRoom to COMPLETED if both parties have signed.
 *
 * No HMAC shared-secret here because the SD-JWT VC itself is the
 * authenticator — Firmas's issuer signature, plus the holder's P-256
 * signature over the contract hash, are jointly stronger than a
 * shared secret. Same trust posture Firmas uses for /api/vouch/import.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";

const FIRMAS_ISSUER = process.env.FIRMAS_ISSUER ?? "https://www.firmas.io";
const FIRMAS_WEB_ORIGIN = process.env.FIRMAS_BASE_URL ?? "https://www.firmas.io";

// Native iOS/Android apps POST directly without a browser Origin
// header, so they bypass CORS entirely. The mobile-web fallback is
// served from `https://www.firmas.io` and IS browser-origin-bound,
// so we whitelist that single origin. Anything else is rejected by
// the browser's preflight check before our handler even runs.
const corsHeaders = {
  "Access-Control-Allow-Origin": FIRMAS_WEB_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "3600",
  // Cache miss vs. hit for a preflight depends on Origin, so make
  // sure shared caches (e.g., Vercel's edge) vary on it.
  "Vary": "Origin",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Small helper: like NextResponse.json but always attaches the CORS
// headers. The native apps don't strictly need them, but the
// mobile-web fallback does, and there's no cost to including them
// unconditionally.
function corsJson(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, { ...init, headers: corsHeaders });
}

const callbackBodySchema = z.object({
  token: z.string().min(1),
  identityCredential: z.string().min(1),
  contractHash: z.string().regex(/^[0-9a-f]{64}$/i, "contractHash must be 64-char hex SHA-256"),
  signatureBase64url: z.string().min(1),
  signedAt: z.number().int().positive(),
});

// ── base64url helpers ─────────────────────────────────────────────────

function base64urlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = Buffer.from(padded, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.toLowerCase();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ── SD-JWT VC inspection ─────────────────────────────────────────────

interface DecodedVc {
  iss: string;
  cnfJwk: JsonWebKey;
  given_name?: string;
  family_name?: string;
  id_region?: string;
  id_number_sha256?: string;
}

function decodeSdJwtVcPayload(sdJwtVc: string): Record<string, unknown> | null {
  // Compact form: <jws>~<disclosure>~<disclosure>~…  We only need
  // the JWS payload here; disclosures matter for selective
  // disclosure but not for the issuer-signature check below
  // (which uses the JWS as a whole).
  const jws = sdJwtVc.split("~")[0] ?? "";
  const segments = jws.split(".");
  if (segments.length < 2) return null;
  try {
    const payloadBytes = base64urlToBytes(segments[1]!);
    const json = new TextDecoder().decode(payloadBytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Fetch the Firmas issuer's JWKS, find the active P-256 key, and
 * verify the SD-JWT VC's JWS signature against it. Returns the
 * decoded payload on success, null on any failure. The trust
 * decision is encapsulated here: ONLY credentials issued by
 * FIRMAS_ISSUER are accepted on this callback (this isn't a
 * generic verifier — Dealroom only ever consumes Firmas-attested
 * identities through this route).
 */
async function verifyFirmasCredential(sdJwtVc: string): Promise<DecodedVc | null> {
  const payload = decodeSdJwtVcPayload(sdJwtVc);
  if (!payload) return null;
  const iss = String(payload.iss ?? "");
  if (iss !== FIRMAS_ISSUER) return null;
  const cnf = payload.cnf as { jwk?: JsonWebKey } | undefined;
  if (!cnf?.jwk) return null;

  // Fetch + cache the issuer metadata. The Firmas JWKS lives at
  // /.well-known/jwt-vc-issuer and exposes `keys: [{ kty, crv, x, y, kid }]`.
  let issuerJwks: JsonWebKey[] = [];
  try {
    const res = await fetch(`${FIRMAS_ISSUER}/.well-known/jwt-vc-issuer`, {
      headers: { Accept: "application/json" },
      // Refresh the issuer metadata at most once an hour — keys
      // don't rotate often and this endpoint is on Firmas's hot path.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const keys = body?.jwks?.keys ?? body?.keys ?? [];
    if (!Array.isArray(keys)) return null;
    issuerJwks = keys;
  } catch {
    return null;
  }

  // JWS signature verify. ES256 over SHA-256(`${header}.${payload}`).
  const jws = sdJwtVc.split("~")[0]!;
  const [headerB64, payloadB64, sigB64] = jws.split(".");
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  const headerJson = new TextDecoder().decode(base64urlToBytes(headerB64));
  const header = JSON.parse(headerJson) as { kid?: string };

  // Find the key whose kid matches (fall back to first key when the
  // credential header doesn't carry one — Firmas always sets kid so
  // this is the historical-credential safety net).
  const candidate = issuerJwks.find((k) => !header.kid || (k as JsonWebKey & { kid?: string }).kid === header.kid)
    ?? issuerJwks[0];
  if (!candidate) return null;

  // Web Crypto verify. Identical primitive Firmas uses to sign.
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sigBytes = base64urlToBytes(sigB64);
  try {
    const key = await crypto.subtle.importKey(
      "jwk", candidate as JsonWebKey,
      { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sigBytes as unknown as ArrayBuffer,
      signingInput as unknown as ArrayBuffer,
    );
    if (!ok) return null;
  } catch {
    return null;
  }

  return {
    iss,
    cnfJwk: cnf.jwk,
    given_name: typeof payload.given_name === "string" ? payload.given_name : undefined,
    family_name: typeof payload.family_name === "string" ? payload.family_name : undefined,
    id_region: typeof payload.id_region === "string" ? payload.id_region : undefined,
    id_number_sha256: typeof payload.id_number_sha256 === "string" ? payload.id_number_sha256 : undefined,
  };
}

/**
 * Verify the contract-hash signature against the holder key from the
 * SD-JWT VC. The holder signs `SHA-256(canonicalised_contract_bundle)`
 * with their device P-256 key; we just check the signature against
 * the cnf.jwk. ES256 = ECDSA P-256 + SHA-256.
 */
async function verifyContractHashSignature(
  cnfJwk: JsonWebKey,
  contractHashHex: string,
  signatureB64url: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "jwk", cnfJwk,
      { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"],
    );
    const hashBytes = hexToBytes(contractHashHex);
    const sigBytes = base64urlToBytes(signatureB64url);
    // The holder signs the raw 32-byte hash, not "hash this then sign".
    // Web Crypto's `verify` with `hash: SHA-256` requires the *input*
    // data, not the digest — so we re-hash here. The wire convention
    // Firmas uses is "sign(plaintext-input → SHA-256 → signature)";
    // see lib/vouch/crypto.ts for the producer side.
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sigBytes as unknown as ArrayBuffer,
      hashBytes as unknown as ArrayBuffer,
    );
  } catch {
    return false;
  }
}

// ── Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: z.infer<typeof callbackBodySchema>;
  try {
    body = callbackBodySchema.parse(await request.json());
  } catch (err) {
    return corsJson(
      { error: "invalid_payload", detail: err instanceof Error ? err.message : "parse failed" },
      { status: 400 },
    );
  }

  // 1. Look up the SigningRequest by EITHER role's token. Both
  //    columns are indexed; the OR fans out to two index probes and
  //    Postgres picks whichever hits. Whichever column matched tells
  //    us which party is signing.
  const signingRequest = await prisma.signingRequest.findFirst({
    where: {
      OR: [
        { initiatorFirmasToken: body.token },
        { respondentFirmasToken: body.token },
      ],
    },
    include: {
      dealRoom: {
        include: { parties: true },
      },
    },
  });
  if (!signingRequest) {
    return corsJson({ error: "unknown_token" }, { status: 404 });
  }
  const signingAs: "INITIATOR" | "RESPONDENT" =
    signingRequest.initiatorFirmasToken === body.token ? "INITIATOR" : "RESPONDENT";

  if (signingRequest.status === "COMPLETED" || signingRequest.status === "DECLINED" || signingRequest.status === "EXPIRED") {
    return corsJson(
      { error: "request_already_settled", status: signingRequest.status },
      { status: 409 },
    );
  }

  // Idempotency / already-signed guard for this specific party. If
  // the matched role already has a signedAt timestamp, we don't want
  // to overwrite their bundle on a Firmas retry — return 409 so the
  // Firmas client knows this token has already been consumed.
  const alreadySigned =
    signingAs === "INITIATOR"
      ? !!signingRequest.initiatorSignedAt
      : !!signingRequest.respondentSignedAt;
  if (alreadySigned) {
    return corsJson(
      { error: "party_already_signed", signingAs },
      { status: 409 },
    );
  }

  // 2. Verify the Firmas identity credential.
  const decoded = await verifyFirmasCredential(body.identityCredential);
  if (!decoded) {
    return corsJson({ error: "credential_invalid" }, { status: 401 });
  }

  // 3. Confirm the contract hash matches what we recorded at signing.initiate.
  if (signingRequest.documentHash && signingRequest.documentHash !== body.contractHash) {
    return corsJson(
      { error: "contract_hash_mismatch", expected: signingRequest.documentHash },
      { status: 409 },
    );
  }

  // 4. Verify the P-256 signature over the contract hash.
  const sigOk = await verifyContractHashSignature(
    decoded.cnfJwk,
    body.contractHash,
    body.signatureBase64url,
  );
  if (!sigOk) {
    return corsJson({ error: "signature_mismatch" }, { status: 401 });
  }

  // 5. Persist the signed bundle + flip the request forward. We
  //    update the matching role's columns based on which token Firmas
  //    sent us in step 1. The "both signed" check fires regardless of
  //    which party signed first.
  const now = new Date();
  const signedBundle = {
    schemaVersion: 1,
    identityCredential: body.identityCredential,
    contractHash: body.contractHash,
    signatureBase64url: body.signatureBase64url,
    signedAt: body.signedAt,
    attestedGivenName: decoded.given_name ?? null,
    attestedFamilyName: decoded.family_name ?? null,
    attestedIdRegion: decoded.id_region ?? null,
    // The hash itself is safe to keep — it can't be reversed to the
    // ID number. Storing it lets future credential presentations
    // recognise "same user, same document" without re-signing.
    attestedIdNumberSha256: decoded.id_number_sha256 ?? null,
  };

  // Project the "this party just signed" plus "other party already
  // signed" booleans so the bothSigned check is symmetrical regardless
  // of which side this callback fires on.
  const otherSigned =
    signingAs === "INITIATOR"
      ? !!signingRequest.respondentSignedAt
      : !!signingRequest.initiatorSignedAt;
  const bothSigned = otherSigned; // this party signs in THIS request → both will be signed iff the other side was already done

  const newStatus = bothSigned ? "COMPLETED" : "PARTIALLY_SIGNED";

  // Build the role-specific update payload.
  const roleUpdate =
    signingAs === "INITIATOR"
      ? {
          initiatorSignedAt: now,
          initiatorSignedBundle: signedBundle as never, // Prisma Json field
        }
      : {
          respondentSignedAt: now,
          respondentSignedBundle: signedBundle as never,
        };

  await prisma.$transaction(async (tx) => {
    await tx.signingRequest.update({
      where: { id: signingRequest.id },
      data: {
        ...roleUpdate,
        status: newStatus,
        completedAt: bothSigned ? now : null,
      },
    });
    if (bothSigned) {
      await tx.dealRoom.update({
        where: { id: signingRequest.dealRoomId },
        data: { status: "COMPLETED" },
      });
    }
  });

  return corsJson({
    ok: true,
    status: newStatus,
    signingAs,
    attestedName: [decoded.given_name, decoded.family_name].filter(Boolean).join(" ") || null,
    attestedRegion: decoded.id_region ?? null,
  });
}
