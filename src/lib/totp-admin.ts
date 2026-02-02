import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Deal Room - Platform Admin";

export function generateAdminSecret(email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.secret.base32;
}

export function verifyAdminToken(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Allow 2 period window for clock drift (60 seconds either direction)
  const delta = totp.validate({ token, window: 2 });
  return delta !== null;
}

export async function generateAdminQRCode(
  secret: string,
  email: string
): Promise<string> {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const otpauthUrl = totp.toString();
  return QRCode.toDataURL(otpauthUrl);
}
