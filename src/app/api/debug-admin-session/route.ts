import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";

export async function GET() {
  const cookieStore = await cookies();

  const allCookies = cookieStore.getAll();
  const cookieNames = allCookies.map(c => c.name);

  const adminToken = cookieStore.get("admin_session")?.value;

  let decoded = null;
  let decodeError = null;

  if (adminToken) {
    try {
      decoded = await decode({
        token: adminToken,
        secret: process.env.NEXTAUTH_SECRET!,
      });
    } catch (error) {
      decodeError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  return NextResponse.json({
    cookieNames,
    hasAdminToken: !!adminToken,
    adminTokenLength: adminToken?.length || 0,
    decoded: decoded ? {
      email: decoded.email,
      adminId: decoded.adminId,
      name: decoded.name,
      sub: decoded.sub,
      iat: decoded.iat,
      exp: decoded.exp,
      allKeys: Object.keys(decoded),
    } : null,
    decodeError,
  });
}
