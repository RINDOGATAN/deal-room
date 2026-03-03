import { features } from "@/config/features";
import { notFound } from "next/navigation";

export default function LawyersLayout({ children }: { children: React.ReactNode }) {
  if (!features.lawyerInvolvement) notFound();
  return <>{children}</>;
}
