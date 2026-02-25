import { features } from "@/config/features";
import { notFound } from "next/navigation";

export default function ClientInviteLayout({ children }: { children: React.ReactNode }) {
  if (!features.clientInvitations) notFound();
  return <>{children}</>;
}
