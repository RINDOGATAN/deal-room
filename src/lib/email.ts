// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Resend } from "resend";
import { brand } from "@/config/brand";
import { createLogger } from "@/lib/logger";
import { mailFrom } from "@/lib/mail-from";
import dealEmailsEn from "@/messages/en.json";
import dealEmailsEs from "@/messages/es.json";

const logger = createLogger("email");

const noopResend = {
  emails: {
    send: async (params: { subject?: string; to?: string | string[] }) => {
      // Local-dev diagnostic (no RESEND_API_KEY set): kept at debug so
      // recipient addresses and subjects never hit info-level production logs.
      logger.debug("Skipped send (no RESEND_API_KEY)", {
        subject: params.subject,
        to: params.to,
      });
      return { data: { id: "skipped" }, error: null };
    },
  },
} as unknown as Resend;

export function getResend() {
  if (!process.env.RESEND_API_KEY) {
    return noopResend;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// Shared email wrapper using brand config
function emailWrapper(subtitle: string, body: string): string {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: ${brand.colors.background}; border-radius: 12px; overflow: hidden;">
      <div style="padding: 24px 24px 16px; border-bottom: 1px solid ${brand.colors.border};">
        <span style="font-size: 20px; font-weight: 700; color: ${brand.colors.foreground}; letter-spacing: 0.05em;">DEALROOM</span>
        <span style="font-size: 13px; color: ${brand.colors.muted}; margin-left: 10px;">${subtitle}</span>
      </div>
      <div style="padding: 32px 24px;">
        ${body}
      </div>
      <div style="padding: 16px 24px; border-top: 1px solid ${brand.colors.border};">
        <p style="color: #666666; font-size: 11px; margin: 0;">${brand.company}&#8482; &middot; DEALROOM &middot; <a href="https://${brand.appDomain}" style="color: ${brand.colors.primary}; text-decoration: none;">${brand.appDomain}</a></p>
      </div>
    </div>
  `;
}

function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display: inline-block; background: ${brand.colors.primary}; color: ${brand.colors.background}; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">${label}</a>`;
}

function emailParagraph(text: string): string {
  return `<p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${text}</p>`;
}

function emailMuted(text: string): string {
  return `<p style="color: ${brand.colors.muted}; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">${text}</p>`;
}

// ────────────────────────────────────────────────────────────

interface SendInvitationEmailParams {
  to: string;
  token: string;
  dealName: string;
  inviterName: string;
}

export async function sendInvitationEmail({
  to,
  token,
  dealName,
  inviterName,
}: SendInvitationEmailParams) {
  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `You're invited to negotiate: ${dealName}`,
      html: emailWrapper("Contract Negotiation", `
        ${emailParagraph(`<strong style="color: ${brand.colors.foreground};">${inviterName}</strong> has invited you to negotiate <strong style="color: ${brand.colors.foreground};">${dealName}</strong> on DEALROOM.`)}
        ${emailButton(inviteUrl, "View Invitation")}
        ${emailMuted("If you weren't expecting this invitation, you can safely ignore it.")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send invitation email", { err: String(error) });
  }
}

interface SendAttorneyReviewRequestEmailParams {
  to: string;
  supervisorName: string;
  dealName: string;
  partyName: string;
  dealRoomId: string;
}

export async function sendAttorneyReviewRequestEmail({
  to,
  supervisorName,
  dealName,
  partyName,
  // dealRoomId intentionally not destructured — the email links to the
  // supervisor portal, not the deal; callers still pass it (interface shape kept).
}: SendAttorneyReviewRequestEmailParams) {
  const portalUrl = `${process.env.NEXTAUTH_URL}/supervise`;

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `Attorney review requested: ${dealName}`,
      html: emailWrapper("Attorney Review", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${supervisorName}</strong>,</p>
        ${emailParagraph(`<strong style="color: ${brand.colors.foreground};">${partyName}</strong> has requested your review of the deal <strong style="color: ${brand.colors.foreground};">${dealName}</strong>.`)}
        ${emailButton(portalUrl, "Open Supervisor Portal")}
        ${emailMuted("Please log in to the supervisor portal to review and approve the contract terms.")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send attorney review request email", { err: String(error) });
  }
}

interface SendRecommendationRequestEmailParams {
  to: string;
  bcc?: string[];
  requesterName: string;
  requesterEmail: string;
  requesterCompany?: string;
  contractType: string;
  governingLaw: string | null;
  message?: string;
  sourceApp?: string;
}

export async function sendRecommendationRequestEmail({
  to,
  bcc,
  requesterName,
  requesterEmail,
  requesterCompany,
  contractType,
  governingLaw,
  message,
  sourceApp,
}: SendRecommendationRequestEmailParams) {
  const requestsUrl = `${process.env.NEXTAUTH_URL}/lawyers/requests`;
  const requesterLabel = requesterCompany
    ? `${requesterName} (${requesterCompany})`
    : requesterName;

  const jurisdictionText = governingLaw
    ? ` (${governingLaw.replace("_", " & ")})`
    : "";

  const messageBlock = message
    ? `<div style="background: ${brand.colors.card}; border-left: 3px solid ${brand.colors.primary}; padding: 12px 16px; margin: 0 0 24px; border-radius: 0 8px 8px 0;">
        <p style="color: ${brand.colors.muted}; font-size: 13px; margin: 0; font-style: italic;">"${message}"</p>
      </div>`
    : "";

  const replyBlock = `<p style="color: ${brand.colors.muted}; font-size: 13px; margin: 0 0 24px;">Reply to the requester directly: <a href="mailto:${requesterEmail}" style="color: ${brand.colors.primary};">${requesterEmail}</a></p>`;

  const subject = sourceApp
    ? `New assistance request: ${contractType}`
    : `New recommendation request: ${contractType}`;

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      ...(bcc && bcc.length > 0 ? { bcc } : {}),
      replyTo: requesterEmail,
      subject,
      html: emailWrapper("Recommendation Request", `
        ${emailParagraph(`<strong style="color: ${brand.colors.foreground};">${requesterLabel}</strong> has requested your recommendation for a <strong style="color: ${brand.colors.foreground};">${contractType}</strong> contract${jurisdictionText}.`)}
        ${messageBlock}
        ${replyBlock}
        ${emailButton(requestsUrl, "View Request")}
        ${emailMuted("You can also accept or decline this request from your dashboard.")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send recommendation request email", { err: String(error) });
  }
}

interface SendJointCounselNotificationEmailParams {
  to: string;
  partyName: string;
  dealName: string;
  supervisorName: string;
  dealRoomId: string;
}

export async function sendJointCounselNotificationEmail({
  to,
  partyName,
  dealName,
  supervisorName,
  dealRoomId,
}: SendJointCounselNotificationEmailParams) {
  const dealUrl = `${process.env.NEXTAUTH_URL}/deals/${dealRoomId}/review`;

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `Joint closing counsel requested: ${dealName}`,
      html: emailWrapper("Joint Counsel", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${partyName}</strong>,</p>
        ${emailParagraph(`The other party has requested <strong style="color: ${brand.colors.foreground};">${supervisorName}</strong> as joint closing counsel for <strong style="color: ${brand.colors.foreground};">${dealName}</strong>. Please review and acknowledge or decline.`)}
        ${emailButton(dealUrl, "Review Request")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send joint counsel notification email", { err: String(error) });
  }
}

interface SendJointCounselAssignmentEmailParams {
  to: string;
  supervisorName: string;
  dealName: string;
  initiatorName: string;
  dealRoomId: string;
}

export async function sendJointCounselAssignmentEmail({
  to,
  supervisorName,
  dealName,
  initiatorName,
  // dealRoomId intentionally not destructured — the email links to the
  // supervisor portal, not the deal; callers still pass it (interface shape kept).
}: SendJointCounselAssignmentEmailParams) {
  const portalUrl = `${process.env.NEXTAUTH_URL}/supervise`;

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `Joint closing counsel assignment: ${dealName}`,
      html: emailWrapper("Joint Counsel Assignment", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${supervisorName}</strong>,</p>
        ${emailParagraph(`You have been requested as joint closing counsel for <strong style="color: ${brand.colors.foreground};">${dealName}</strong> by <strong style="color: ${brand.colors.foreground};">${initiatorName}</strong>. Both parties will need your guidance to finalize the agreement.`)}
        ${emailButton(portalUrl, "Open Supervisor Portal")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send joint counsel assignment email", { err: String(error) });
  }
}

interface SendSigningInitiatedEmailParams {
  to: string;
  partyName: string;
  dealName: string;
  initiatedByName: string;
  dealRoomId: string;
}

export async function sendSigningInitiatedEmail({
  to,
  partyName,
  dealName,
  initiatedByName,
  dealRoomId,
}: SendSigningInitiatedEmailParams) {
  const dealUrl = `${process.env.NEXTAUTH_URL}/deals/${dealRoomId}/review`;

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `Ready to sign: ${dealName}`,
      html: emailWrapper("Contract Signing", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${partyName}</strong>,</p>
        ${emailParagraph(`<strong style="color: ${brand.colors.foreground};">${initiatedByName}</strong> has initiated signing for <strong style="color: ${brand.colors.foreground};">${dealName}</strong>. Please review your execution details and sign.`)}
        ${emailButton(dealUrl, "Go to Deal")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send signing initiated email", { err: String(error) });
  }
}

interface SendSigningNudgeEmailParams {
  to: string;
  partyName: string;
  senderName: string;
  dealName: string;
  dealRoomId: string;
}

/**
 * Manual nudge a party sends from the sign page when the counterparty has
 * stalled (no details / no signature for a week). Distinct from the cron's
 * expiring-soon email: this one is human-initiated and names the sender.
 */
export async function sendSigningNudgeEmail({
  to,
  partyName,
  senderName,
  dealName,
  dealRoomId,
}: SendSigningNudgeEmailParams) {
  const dealUrl = `${process.env.NEXTAUTH_URL}/deals/${dealRoomId}/sign`;

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `Reminder from ${senderName}: ${dealName} is waiting for you`,
      html: emailWrapper("Contract Signing", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${partyName}</strong>,</p>
        ${emailParagraph(`<strong style="color: ${brand.colors.foreground};">${senderName}</strong> is waiting on you to complete the signing for <strong style="color: ${brand.colors.foreground};">${dealName}</strong>. Add your execution details and sign to finish the deal.`)}
        ${emailButton(dealUrl, "Complete Signing")}
        ${emailMuted("If you have already signed, no action is needed.")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send signing nudge email", { err: String(error) });
  }
}

interface SendSigningExpiringSoonEmailParams {
  to: string;
  partyName: string;
  dealName: string;
  daysRemaining: number;
  dealRoomId: string;
}

export async function sendSigningExpiringSoonEmail({
  to,
  partyName,
  dealName,
  daysRemaining,
  dealRoomId,
}: SendSigningExpiringSoonEmailParams) {
  const dealUrl = `${process.env.NEXTAUTH_URL}/deals/${dealRoomId}/sign`;
  const dayWord = daysRemaining === 1 ? "day" : "days";

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `Reminder: signing expires in ${daysRemaining} ${dayWord} — ${dealName}`,
      html: emailWrapper("Contract Signing", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${partyName}</strong>,</p>
        ${emailParagraph(`The signing for <strong style="color: ${brand.colors.foreground};">${dealName}</strong> expires in <strong style="color: ${brand.colors.foreground};">${daysRemaining} ${dayWord}</strong>. After that, the parties will need to start a new signing.`)}
        ${emailButton(dealUrl, "Sign Now")}
        ${emailMuted("If you have already signed, no action is needed — this reminder will stop once the other party signs too.")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send signing-expiring email", { err: String(error) });
  }
}

interface SendSigningExpiredEmailParams {
  to: string;
  partyName: string;
  dealName: string;
  dealRoomId: string;
}

export async function sendSigningExpiredEmail({
  to,
  partyName,
  dealName,
  dealRoomId,
}: SendSigningExpiredEmailParams) {
  const dealUrl = `${process.env.NEXTAUTH_URL}/deals/${dealRoomId}`;

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `Signing expired: ${dealName}`,
      html: emailWrapper("Contract Signing", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${partyName}</strong>,</p>
        ${emailParagraph(`The signing for <strong style="color: ${brand.colors.foreground};">${dealName}</strong> has expired without both parties signing. The deal has been returned to the agreed state, so you can start a new signing whenever you are ready.`)}
        ${emailButton(dealUrl, "Open Deal")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send signing-expired email", { err: String(error) });
  }
}

interface SendCounterpartySignedEmailParams {
  to: string;
  partyName: string;
  dealName: string;
  signerName: string;
  dealRoomId: string;
}

export async function sendCounterpartySignedEmail({
  to,
  partyName,
  dealName,
  signerName,
  dealRoomId,
}: SendCounterpartySignedEmailParams) {
  const dealUrl = `${process.env.NEXTAUTH_URL}/deals/${dealRoomId}/review`;

  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `${signerName} has signed: ${dealName}`,
      html: emailWrapper("Contract Signing", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${partyName}</strong>,</p>
        ${emailParagraph(`<strong style="color: ${brand.colors.foreground};">${signerName}</strong> has signed <strong style="color: ${brand.colors.foreground};">${dealName}</strong>. It's now your turn to review and sign.`)}
        ${emailButton(dealUrl, "Sign Now")}
      `),
    });
  } catch (error) {
    logger.error("Failed to send counterparty signed email", { err: String(error) });
  }
}

interface SendFirmasSigningEmailParams {
  to: string;
  initiatorName: string;
  contractType: string;
  signUrl: string;
}

/**
 * Mobile-signing invitation. Plain-language ("80-yo-test") body — the
 * link opens the Firmas app via Universal Link on iOS/Android, or
 * falls back to firmas.io/sign/<token> in mobile Safari if the app
 * isn't installed.
 */
export async function sendFirmasSigningEmail({
  to,
  initiatorName,
  contractType,
  signUrl,
}: SendFirmasSigningEmailParams) {
  try {
    await getResend().emails.send({
      from: mailFrom(),
      to,
      subject: `${initiatorName} asked you to sign a ${contractType}`,
      html: emailWrapper("Sign on your phone", `
        ${emailParagraph(`<strong style="color: ${brand.colors.foreground};">${initiatorName}</strong> sent you a <strong style="color: ${brand.colors.foreground};">${contractType}</strong> to sign.`)}
        ${emailParagraph(`Open this link <strong style="color: ${brand.colors.foreground};">on your phone</strong> — it will open the Firmas app where you can read it and sign with one tap.`)}
        ${emailButton(signUrl, "Open in Firmas")}
        ${emailMuted(`If you don't have Firmas yet, the same link opens a web page on your phone that walks you through signing. Either way works.`)}
        ${emailMuted(`Link: <a href="${signUrl}" style="color: ${brand.colors.primary};">${signUrl}</a>`)}
      `),
    });
  } catch (error) {
    logger.error("Failed to send Firmas signing email", { err: String(error) });
  }
}

// ────────────────────────────────────────────────────────────
// Transactional deal emails (owner decisions of 2026-10-04):
// "your turn", invitation reminders, "your contract is ready" and the
// unfinished-draft reminder. Wording lives in the `dealEmails` namespace of
// src/messages/{en,es}.json; who gets what and when is decided in
// src/lib/deal-notifications.ts.
// ────────────────────────────────────────────────────────────

export type DealEmailKind =
  | "TURN_SELECTIONS"
  | "TURN_COUNTER"
  | "INVITE_DAY3"
  | "INVITE_DAY10"
  | "READY"
  | "DRAFT";

export type DealEmailLanguage = "en" | "es";

export interface DealEmailInput {
  kind: DealEmailKind;
  language: DealEmailLanguage;
  /** Absolute link for the button (also printed as plain text). */
  url: string;
  dealName: string;
  /** Recipient's name, for the greeting; omitted when unknown. */
  recipientName?: string | null;
  /** The other party (turn emails) or the person who invited (invitation reminders). */
  otherName?: string | null;
  /** Display price for READY, already formatted in the recipient's currency. */
  price?: string | null;
  /** Invitation expiry, for INVITE_DAY10. */
  expiresAt?: Date;
}

export interface RenderedDealEmail {
  subject: string;
  html: string;
  text: string;
}

type DealEmailMessages = (typeof dealEmailsEn)["dealEmails"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Fill `{name}` placeholders; in HTML the values are escaped and the deal name and price are bold. */
function fill(template: string, vars: Record<string, string>, html: boolean): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    if (value === undefined) return match;
    if (!html) return value;
    const safe = escapeHtml(value);
    return key === "dealName" || key === "price"
      ? `<strong style="color: ${brand.colors.foreground};">${safe}</strong>`
      : safe;
  });
}

function formatExpiry(date: Date, language: DealEmailLanguage): string {
  return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Subject and body of one deal email, in the recipient's language. Pure; exported for tests. */
export function renderDealEmail(input: DealEmailInput): RenderedDealEmail {
  const m: DealEmailMessages = (input.language === "es" ? dealEmailsEs : dealEmailsEn).dealEmails;
  const other = input.otherName?.trim() || m.otherParty;
  const vars: Record<string, string> = {
    dealName: input.dealName,
    name: other,
    inviter: other,
    price: input.price ?? "",
    expiry: input.expiresAt ? formatExpiry(input.expiresAt, input.language) : "",
  };

  let subject: string;
  let lines: string[];
  let button: string;
  let footer: string = m.footer;
  switch (input.kind) {
    case "TURN_SELECTIONS":
    case "TURN_COUNTER":
      subject = m.turnSubject;
      lines = [input.kind === "TURN_SELECTIONS" ? m.turnSelectionsBody : m.turnCounterBody];
      button = m.turnButton;
      break;
    case "INVITE_DAY3":
      subject = m.inviteDay3Subject;
      lines = [m.inviteDay3Body];
      button = m.inviteButton;
      footer = m.inviteFooter;
      break;
    case "INVITE_DAY10":
      subject = m.inviteDay10Subject;
      lines = [m.inviteDay10Body];
      button = m.inviteButton;
      footer = m.inviteFooter;
      break;
    case "READY":
      subject = m.readySubject;
      lines = [m.readyBody, input.price ? m.readyPrice : m.readyNoPrice];
      button = m.readyButton;
      footer = m.readyFooter;
      break;
    case "DRAFT":
      subject = m.draftSubject;
      lines = [m.draftBody];
      button = m.draftButton;
      break;
  }

  const recipient = input.recipientName?.trim();
  const greeting = recipient && !recipient.includes("@") ? m.greeting : null;
  const greetingVars = { name: recipient ?? "" };
  const url = escapeHtml(input.url);

  const html = emailWrapper(
    escapeHtml(m.subtitle),
    [
      greeting ? emailParagraph(fill(greeting, greetingVars, true)) : "",
      ...lines.map((line) => emailParagraph(fill(line, vars, true))),
      emailButton(url, escapeHtml(button)),
      emailMuted(`<a href="${url}" style="color: ${brand.colors.primary};">${url}</a>`),
      emailMuted(escapeHtml(footer)),
    ].join("\n"),
  );

  const text = [
    greeting ? fill(greeting, greetingVars, false) : null,
    ...lines.map((line) => fill(line, vars, false)),
    `${button}: ${input.url}`,
    footer,
  ]
    .filter((part): part is string => !!part)
    .join("\n\n");

  return { subject: fill(subject, vars, false), html, text };
}

/** Send one deal email. True when the provider accepted it (or no provider is configured). */
export async function sendDealEmail(to: string, input: DealEmailInput): Promise<boolean> {
  const { subject, html, text } = renderDealEmail(input);
  try {
    const result = await getResend().emails.send({ from: mailFrom(), to, subject, html, text });
    if (result?.error) {
      logger.error("Deal email rejected by the provider", {
        kind: input.kind,
        err: String(result.error.message ?? result.error),
      });
      return false;
    }
    return true;
  } catch (error) {
    logger.error("Failed to send deal email", { kind: input.kind, err: String(error) });
    return false;
  }
}
