import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

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
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject: `You're invited to negotiate: ${dealName}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px 24px 16px; border-bottom: 1px solid #2a2a2a;">
            <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">DEALROOM</span>
            <span style="font-size: 13px; color: #a6a6a6; margin-left: 10px;">Contract Negotiation</span>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;"><strong style="color: #ffffff;">${inviterName}</strong> has invited you to negotiate <strong style="color: #ffffff;">${dealName}</strong> on DEALROOM.</p>
            <a href="${inviteUrl}" style="display: inline-block; background: #53aecc; color: #1a1a1a; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">View Invitation</a>
            <p style="color: #a6a6a6; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">If you weren't expecting this invitation, you can safely ignore it.</p>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid #2a2a2a;">
            <p style="color: #666666; font-size: 11px; margin: 0;">TODO.LAW&#8482; &middot; DEALROOM &middot; <a href="https://dealroom.todo.law" style="color: #53aecc; text-decoration: none;">dealroom.todo.law</a></p>
          </div>
        </div>
      `,
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
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject: `Attorney review requested: ${dealName}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px 24px 16px; border-bottom: 1px solid #2a2a2a;">
            <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">DEALROOM</span>
            <span style="font-size: 13px; color: #a6a6a6; margin-left: 10px;">Attorney Review</span>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: #ffffff;">${supervisorName}</strong>,</p>
            <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;"><strong style="color: #ffffff;">${partyName}</strong> has requested your review of the deal <strong style="color: #ffffff;">${dealName}</strong>.</p>
            <a href="${portalUrl}" style="display: inline-block; background: #53aecc; color: #1a1a1a; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Open Supervisor Portal</a>
            <p style="color: #a6a6a6; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">Please log in to the supervisor portal to review and approve the contract terms.</p>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid #2a2a2a;">
            <p style="color: #666666; font-size: 11px; margin: 0;">TODO.LAW&#8482; &middot; DEALROOM &middot; <a href="https://dealroom.todo.law" style="color: #53aecc; text-decoration: none;">dealroom.todo.law</a></p>
          </div>
        </div>
      `,
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
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject: `Your lawyer has prepared a contract for you: ${templateName}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px 24px 16px; border-bottom: 1px solid #2a2a2a;">
            <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">DEALROOM</span>
            <span style="font-size: 13px; color: #a6a6a6; margin-left: 10px;">Attorney-Vetted Contract</span>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
              <strong style="color: #ffffff;">${lawyerName}</strong> has reviewed and pre-approved a <strong style="color: #ffffff;">${templateName}</strong> contract for you.
            </p>
            <div style="background: #2a2a2a; border-left: 3px solid #53aecc; padding: 12px 16px; margin: 0 0 24px; border-radius: 0 8px 8px 0;">
              <p style="color: #a6a6a6; font-size: 13px; margin: 0;">Your lawyer has pre-selected recommended options for each clause. You'll see their recommendations as you negotiate.</p>
            </div>
            <a href="${inviteUrl}" style="display: inline-block; background: #53aecc; color: #1a1a1a; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Start Your Contract</a>
            <p style="color: #a6a6a6; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">This link expires in 30 days. If you weren't expecting this, you can safely ignore it.</p>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid #2a2a2a;">
            <p style="color: #666666; font-size: 11px; margin: 0;">TODO.LAW&#8482; &middot; DEALROOM &middot; <a href="https://dealroom.todo.law" style="color: #53aecc; text-decoration: none;">dealroom.todo.law</a></p>
          </div>
        </div>
      `,
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
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject: `Joint closing counsel requested: ${dealName}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px 24px 16px; border-bottom: 1px solid #2a2a2a;">
            <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">DEALROOM</span>
            <span style="font-size: 13px; color: #a6a6a6; margin-left: 10px;">Joint Counsel</span>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: #ffffff;">${partyName}</strong>,</p>
            <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">The other party has requested <strong style="color: #ffffff;">${supervisorName}</strong> as joint closing counsel for <strong style="color: #ffffff;">${dealName}</strong>. Please review and acknowledge or decline.</p>
            <a href="${dealUrl}" style="display: inline-block; background: #53aecc; color: #1a1a1a; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Review Request</a>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid #2a2a2a;">
            <p style="color: #666666; font-size: 11px; margin: 0;">TODO.LAW&#8482; &middot; DEALROOM &middot; <a href="https://dealroom.todo.law" style="color: #53aecc; text-decoration: none;">dealroom.todo.law</a></p>
          </div>
        </div>
      `,
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
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject: `Joint closing counsel assignment: ${dealName}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px 24px 16px; border-bottom: 1px solid #2a2a2a;">
            <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">DEALROOM</span>
            <span style="font-size: 13px; color: #a6a6a6; margin-left: 10px;">Joint Counsel Assignment</span>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Dear <strong style="color: #ffffff;">${supervisorName}</strong>,</p>
            <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">You have been requested as joint closing counsel for <strong style="color: #ffffff;">${dealName}</strong> by <strong style="color: #ffffff;">${initiatorName}</strong>. Both parties will need your guidance to finalize the agreement.</p>
            <a href="${portalUrl}" style="display: inline-block; background: #53aecc; color: #1a1a1a; padding: 12px 28px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 24px;">Open Supervisor Portal</a>
          </div>
          <div style="padding: 16px 24px; border-top: 1px solid #2a2a2a;">
            <p style="color: #666666; font-size: 11px; margin: 0;">TODO.LAW&#8482; &middot; DEALROOM &middot; <a href="https://dealroom.todo.law" style="color: #53aecc; text-decoration: none;">dealroom.todo.law</a></p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send joint counsel assignment email:", error);
  }
}
