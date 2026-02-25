"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { Menu } from "lucide-react";
import { DocsNav } from "./components/DocsNav";
import { features } from "@/config/features";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!features.publicDocs) notFound();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="lg:grid lg:grid-cols-[260px_1fr] gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <DocsNav />
          </div>
        </aside>

        {/* Main Content */}
        <div className="min-w-0">{children}</div>
      </div>

      {/* Mobile Floating Button + Sheet */}
      <div className="lg:hidden fixed bottom-6 left-6 z-30">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-6">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <DocsNav onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
