import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkEntitlement } from "@/server/services/licensing";
import { verifyDownloadToken } from "@/lib/crypto";
import { apiError } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const { skillId } = await params;

  try {
    // Auth: session OR signed download token
    let customerId: string | null = null;

    const token = request.nextUrl.searchParams.get("token");
    if (token) {
      const payload = verifyDownloadToken(token);
      if (!payload || payload.skillId !== skillId) {
        return NextResponse.json(
          { error: "Invalid or expired download token" },
          { status: 401 }
        );
      }
      customerId = payload.customerId;
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const customer = await prisma.customer.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "No customer account found" },
          { status: 403 }
        );
      }
      customerId = customer.id;
    }

    // Check entitlement
    const entitlement = await checkEntitlement(customerId, skillId);
    if (!entitlement.entitled) {
      return NextResponse.json(
        { error: entitlement.reason || "Not entitled to this skill" },
        { status: 403 }
      );
    }

    // Look up the skill package
    const skillPackage = await prisma.skillPackage.findUnique({
      where: { skillId },
    });

    if (!skillPackage) {
      return NextResponse.json(
        { error: "Skill package not found" },
        { status: 404 }
      );
    }

    if (!skillPackage.packageUrl) {
      return NextResponse.json(
        { error: "Package file not available for download" },
        { status: 404 }
      );
    }

    // Log the download
    await prisma.auditLog.create({
      data: {
        action: "SKILL_DOWNLOAD",
        details: {
          skillId,
          customerId,
          packageVersion: skillPackage.version,
        },
      },
    });

    // Redirect to the package URL (Vercel Blob signed URL or direct)
    return NextResponse.redirect(skillPackage.packageUrl);
  } catch (error) {
    return apiError(error, "Download failed");
  }
}
