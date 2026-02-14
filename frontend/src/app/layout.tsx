import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Siete Engine — AI Marketing",
  description: "AI-powered B2B content marketing engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-gray-100 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
