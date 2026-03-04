import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const cookieStore = await cookies();

  const allCookies = cookieStore.getAll().map((c) => c.name);
  const supervisorToken = cookieStore.get("supervisor_session")?.value;
  const supervisor2FA = cookieStore.get("supervisor_2fa_verified")?.value;

  let decoded: Record<string, unknown> | null = null;
  let decodeError: string | null = null;

  if (supervisorToken) {
    try {
      decoded = (await decode({
        token: supervisorToken,
        secret: process.env.NEXTAUTH_SECRET!,
      })) as Record<string, unknown> | null;
    } catch (e) {
      decodeError = (e as Error).message;
    }
  }

  let dbSupervisor: { id: string; email: string; isActive: boolean; has2FA: boolean } | null =
    null;
  if (decoded?.email) {
    const sup = await prisma.supervisor.findUnique({
      where: { email: (decoded.email as string).toLowerCase() },
      include: { twoFactorSecret: true },
    });
    if (sup) {
      dbSupervisor = {
        id: sup.id,
        email: sup.email,
        isActive: sup.isActive,
        has2FA: !!sup.twoFactorSecret,
      };
    }
  }

  return NextResponse.json({
    cookies: allCookies,
    hasSupervisorSession: !!supervisorToken,
    supervisor2FA,
    decoded: decoded
      ? {
          email: decoded.email,
          supervisorId: decoded.supervisorId,
          sub: decoded.sub,
          exp: decoded.exp,
          iat: decoded.iat,
        }
      : null,
    decodeError,
    dbSupervisor,
  });
}
