import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { adminAuthOptions } from "@/lib/auth-admin";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(adminAuthOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get platform admin by email
  const admin = await prisma.platformAdmin.findUnique({
    where: { email: session.user.email.toLowerCase() },
    include: { twoFactorSecret: true },
  });

  if (!admin || !admin.isActive) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify that the admin has a verified 2FA secret
  if (!admin.twoFactorSecret?.verified) {
    return NextResponse.json({ error: "2FA not verified" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });

  // Set secure httpOnly cookie that expires in 4 hours
  response.cookies.set("platform_admin_2fa_verified", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 4 * 60 * 60, // 4 hours in seconds
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  // Clear the 2FA verification cookie
  response.cookies.delete("platform_admin_2fa_verified");

  return response;
}
