import { Resend } from "resend";
import { brand } from "@/config/brand";

export function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
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

function emailFrom(): string {
  return process.env.EMAIL_FROM || "onboarding@resend.dev";
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
      from: emailFrom(),
      to,
      subject: `You're invited to negotiate: ${dealName}`,
      html: emailWrapper("Contract Negotiation", `
        ${emailParagraph(`<strong style="color: ${brand.colors.foreground};">${inviterName}</strong> has invited you to negotiate <strong style="color: ${brand.colors.foreground};">${dealName}</strong> on DEALROOM.`)}
        ${emailButton(inviteUrl, "View Invitation")}
        ${emailMuted("If you weren't expecting this invitation, you can safely ignore it.")}
      `),
    });
  } catch (error) {
    console.error("Failed to send invitation email:", error);
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
  dealRoomId,
}: SendAttorneyReviewRequestEmailParams) {
  const portalUrl = `${process.env.NEXTAUTH_URL}/supervise`;

  try {
    await getResend().emails.send({
      from: emailFrom(),
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
    console.error("Failed to send attorney review request email:", error);
  }
}

interface SendClientInvitationEmailParams {
  to: string;
  token: string;
  templateName: string;
  lawyerName: string;
}

export async function sendClientInvitationEmail({
  to,
  token,
  templateName,
  lawyerName,
}: SendClientInvitationEmailParams) {
  const inviteUrl = `${process.env.NEXTAUTH_URL}/client-invite/${token}`;

  try {
    await getResend().emails.send({
      from: emailFrom(),
      to,
      subject: `Your lawyer has prepared a contract for you: ${templateName}`,
      html: emailWrapper("Attorney-Vetted Contract", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          <strong style="color: ${brand.colors.foreground};">${lawyerName}</strong> has reviewed and pre-approved a <strong style="color: ${brand.colors.foreground};">${templateName}</strong> contract for you.
        </p>
        <div style="background: ${brand.colors.card}; border-left: 3px solid ${brand.colors.primary}; padding: 12px 16px; margin: 0 0 24px; border-radius: 0 8px 8px 0;">
          <p style="color: ${brand.colors.muted}; font-size: 13px; margin: 0;">Your lawyer has pre-selected recommended options for each clause. You'll see their recommendations as you negotiate.</p>
        </div>
        ${emailButton(inviteUrl, "Start Your Contract")}
        ${emailMuted("This link expires in 30 days. If you weren't expecting this, you can safely ignore it.")}
      `),
    });
  } catch (error) {
    console.error("Failed to send client invitation email:", error);
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
      from: emailFrom(),
      to,
      subject: `Joint closing counsel requested: ${dealName}`,
      html: emailWrapper("Joint Counsel", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${partyName}</strong>,</p>
        ${emailParagraph(`The other party has requested <strong style="color: ${brand.colors.foreground};">${supervisorName}</strong> as joint closing counsel for <strong style="color: ${brand.colors.foreground};">${dealName}</strong>. Please review and acknowledge or decline.`)}
        ${emailButton(dealUrl, "Review Request")}
      `),
    });
  } catch (error) {
    console.error("Failed to send joint counsel notification email:", error);
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
  dealRoomId,
}: SendJointCounselAssignmentEmailParams) {
  const portalUrl = `${process.env.NEXTAUTH_URL}/supervise`;

  try {
    await getResend().emails.send({
      from: emailFrom(),
      to,
      subject: `Joint closing counsel assignment: ${dealName}`,
      html: emailWrapper("Joint Counsel Assignment", `
        <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: ${brand.colors.foreground};">${supervisorName}</strong>,</p>
        ${emailParagraph(`You have been requested as joint closing counsel for <strong style="color: ${brand.colors.foreground};">${dealName}</strong> by <strong style="color: ${brand.colors.foreground};">${initiatorName}</strong>. Both parties will need your guidance to finalize the agreement.`)}
        ${emailButton(portalUrl, "Open Supervisor Portal")}
      `),
    });
  } catch (error) {
    console.error("Failed to send joint counsel assignment email:", error);
  }
}
