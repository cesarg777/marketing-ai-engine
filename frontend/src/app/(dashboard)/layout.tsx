import Sidebar from "@/components/layout/Sidebar";
import AuthGuard from "@/components/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[var(--surface-base)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-8 max-w-[1200px]">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
