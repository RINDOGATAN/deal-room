import { features } from "@/config/features";
import { notFound } from "next/navigation";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  if (!features.billing) notFound();
  return <>{children}</>;
}
