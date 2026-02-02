"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

function AuthErrorRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    // Check cookies to determine which portal the user was trying to access
    const cookies = document.cookie;

    if (cookies.includes("admin_csrf") || cookies.includes("admin_callback")) {
      // User was trying to access admin portal
      router.replace(`/admin/error?error=${error || "Default"}`);
    } else if (cookies.includes("supervisor_csrf") || cookies.includes("supervisor_callback")) {
      // User was trying to access supervisor portal
      router.replace(`/supervise/error?error=${error || "Default"}`);
    } else {
      // Default to admin error page
      router.replace(`/admin/error?error=${error || "Default"}`);
    }
  }, [router, error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthErrorRedirect />
    </Suspense>
  );
}
