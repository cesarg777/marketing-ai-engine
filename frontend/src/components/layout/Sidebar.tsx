"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  LayoutTemplate,
  Sparkles,
  Library,
  BarChart3,
  Megaphone,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/research", label: "Research", icon: Search },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/content", label: "Content", icon: Library },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/amplify", label: "Amplify", icon: Megaphone },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-gray-950 text-gray-300 flex flex-col border-r border-gray-800">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white tracking-tight">
          Siete<span className="text-indigo-400">Engine</span>
        </h1>
        <p className="text-xs text-gray-500 mt-1">AI Marketing Engine</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "hover:bg-gray-800/50 hover:text-white"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-600">v0.1.0 MVP</div>
      </div>
    </aside>
  );
}
