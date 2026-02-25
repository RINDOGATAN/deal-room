import { features } from "@/config/features";
import { notFound } from "next/navigation";

export default function LawyerLayout({ children }: { children: React.ReactNode }) {
  if (!features.lawyerInvolvement) notFound();
  return <>{children}</>;
}
