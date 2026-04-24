import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supervisorToken = cookieStore.get("supervisor_session")?.value;

    if (!supervisorToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let supervisorId: string | null = null;
    try {
      const decoded = await decode({
        token: supervisorToken,
        secret: process.env.NEXTAUTH_SECRET!,
      });
      supervisorId = (decoded?.supervisorId as string) ?? (decoded?.sub as string) ?? null;
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (!supervisorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get supervisor by ID
    const supervisor = await prisma.supervisor.findUnique({
      where: { id: supervisorId },
      include: { twoFactorSecret: true },
    });

    if (!supervisor || !supervisor.isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify that the supervisor has a verified 2FA secret
    if (!supervisor.twoFactorSecret?.verified) {
      return NextResponse.json({ error: "2FA not verified" }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });

    // Set secure httpOnly cookie that expires in 4 hours
    response.cookies.set("supervisor_2fa_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 4 * 60 * 60, // 4 hours in seconds
      path: "/",
    });

    return response;
  } catch (error) {
    return apiError(error, "2FA verification failed");
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  // Clear the 2FA verification cookie
  response.cookies.delete("supervisor_2fa_verified");

  return response;
}
