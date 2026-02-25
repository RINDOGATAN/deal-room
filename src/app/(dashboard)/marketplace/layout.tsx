import { features } from "@/config/features";
import { notFound } from "next/navigation";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  if (!features.marketplace) notFound();
  return <>{children}</>;
}
