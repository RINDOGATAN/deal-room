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
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h1 style="color: #13e9d1; background: #1c1f37; padding: 20px; margin: 0;">DEALROOM</h1>
          <div style="padding: 20px; background: #f5f5f5;">
            <p><strong>${inviterName}</strong> has invited you to negotiate <strong>${dealName}</strong> on DEALROOM.</p>
            <p>Click the button below to review and accept the invitation:</p>
            <a href="${inviteUrl}" style="display: inline-block; background: #1c1f37; color: #13e9d1; padding: 12px 24px; text-decoration: none; font-weight: bold; margin: 20px 0;">View Invitation</a>
            <p style="color: #666; font-size: 14px;">If you weren't expecting this invitation, you can safely ignore it.</p>
            <p style="color: #666; font-size: 12px;">Or copy this link: ${inviteUrl}</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send invitation email:", error);
  }
}
