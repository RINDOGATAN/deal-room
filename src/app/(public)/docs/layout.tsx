import { DocsNav } from "./components/DocsNav";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-5 gap-8">
        {/* Sidebar */}
        <aside className="col-span-1">
          <div className="sticky top-8">
            <DocsNav />
          </div>
        </aside>

        {/* Main Content */}
        <div className="col-span-4">{children}</div>
      </div>
    </div>
  );
}
