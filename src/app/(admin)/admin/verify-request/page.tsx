"use client";

import { Mail, Shield } from "lucide-react";
import Link from "next/link";

export default function AdminVerifyRequestPage() {
  return (
    <div className="w-full max-w-md">
      <div className="card-brutal text-center">
        <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-muted-foreground mb-6">
          A sign-in link has been sent to your email address.
          Click the link to access the Platform Admin Portal.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-primary">
          <Shield className="w-4 h-4" />
          <span>Platform Admin</span>
        </div>
        <div className="mt-6 pt-6 border-t border-border">
          <Link
            href="/admin/sign-in"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
