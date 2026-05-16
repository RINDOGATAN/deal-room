/**
 * Public bundle endpoint for the Firmas sign-hand-off flow.
 *
 * Counterpart to `signing.sendToFirmas` (tRPC) and the
 * `/api/signing/firmas-callback` receiver. After Dealroom mints
 * the `firmas.io/sign/<token>` URL, the user lands on a Firmas page
 * that needs to know what they're signing. Firmas calls THIS
 * endpoint to fetch the contract terms + document hash for the
 * given token, displays them, gates Sign on the local identity
 * attestation, then POSTs the signed bundle back to firmas-callback.
 *
 * No auth header — the token in the path IS the capability. Same
 * security model as Dealroom's Invitation magic-link and Firmas's
 * own /verify/<short_id> path. The token is unguessable (UUID v4),
 * indexed in Postgres, and a SigningRequest only ever holds one
 * token at a time (mint-once, reuse-on-replay-button).
 *
 * Returns 404 for unknown tokens (so a brute-force attacker can't
 * distinguish "token exists but request is settled" from "token
 * never existed") and 410 for settled requests so a legitimate
 * follow-up retry sees a useful error.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateContractData } from "@/server/services/document/generator";
import { apiError } from "@/lib/api-response";
import { createHash } from "crypto";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 400 });
    }

    const signingRequest = await prisma.signingRequest.findUnique({
      where: { firmasToken: token },
      include: {
        dealRoom: {
          include: {
            parties: { include: { user: true } },
            clauses: true,
            contractTemplate: true,
          },
        },
      },
    });

    if (!signingRequest) {
      // Don't disclose whether the token "could have" existed; 404 here
      // is the same response a totally-random token would get.
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (signingRequest.status === "COMPLETED" || signingRequest.status === "DECLINED" || signingRequest.status === "EXPIRED") {
      return NextResponse.json(
        {
          error: "request_already_settled",
          status: signingRequest.status,
          completedAt: signingRequest.completedAt,
        },
        { status: 410 },
      );
    }

    // Build the contract bundle. `generateContractData` does the heavy
    // lifting — it composes the parties, clauses, boilerplate, and
    // jurisdiction-specific framing into a single ContractData object.
    // It returns null when the underlying deal is missing — should be
    // impossible here because we just loaded the SigningRequest via
    // its dealRoom relation, but guard anyway since the function's
    // contract allows null.
    const contractData = await generateContractData(signingRequest.dealRoomId);
    if (!contractData) {
      return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
    }

    // Canonical document hash. If the SigningRequest already has one
    // recorded (signing.initiate sets it), we surface that so the
    // hash the user signs is identical to the one stored at initiate
    // time. Falls back to computing freshly if absent.
    const canonical = JSON.stringify(contractData, Object.keys(contractData as unknown as Record<string, unknown>).sort());
    const computedHash = createHash("sha256").update(canonical).digest("hex");
    const documentHash = signingRequest.documentHash ?? computedHash;

    // Minimal respondent-facing view of the deal. We strip server-side
    // bookkeeping fields (audit IDs, attorney-review state, etc.) so
    // the Firmas page renders just what the signer needs to read and
    // accept. The contract templating is server-side anyway; the
    // structure here is rendered as-is.
    const initiatorParty = signingRequest.dealRoom.parties.find((p) => p.role === "INITIATOR");
    const respondentParty = signingRequest.dealRoom.parties.find((p) => p.role === "RESPONDENT");

    return NextResponse.json({
      schemaVersion: 1,
      dealRoomId: signingRequest.dealRoomId,
      documentHash,
      contractType: contractData.contractType,
      contractTitle: contractData.dealName,
      governingLaw: contractData.governingLaw,
      language: contractData.language,
      createdAt: contractData.createdAt,
      initiator: {
        name: initiatorParty?.user?.name ?? contractData.partyA?.legalName ?? null,
        email: initiatorParty?.email ?? null,
        legalName: contractData.partyA?.legalName ?? null,
      },
      respondent: {
        // We never echo the respondent's email or any other PII the
        // initiator entered; the signer is presumed to be the
        // respondent (their device has the link, after all) and
        // already knows their own name.
        legalName: contractData.partyB?.legalName ?? respondentParty?.name ?? null,
      },
      // ClauseData exposes title, category, agreedOption, legalText —
      // we surface title + legalText (the body the user will sign) and
      // the agreed option label for readability. Definitions live at the
      // ContractData level on this codebase, not per-clause.
      clauses: contractData.clauses.map((c, i) => ({
        number: i + 1,
        title: c.title,
        category: c.category,
        agreedOption: c.agreedOption,
        legalText: c.legalText,
      })),
      boilerplate: contractData.boilerplate,
      sentAt: signingRequest.firmasSentAt,
      expiresAt: signingRequest.expiresAt,
    });
  } catch (error) {
    return apiError(error, "Failed to load signing bundle");
  }
}
