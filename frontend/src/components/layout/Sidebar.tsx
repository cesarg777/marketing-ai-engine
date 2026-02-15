"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Search,
  LayoutTemplate,
  Sparkles,
  Library,
  BarChart3,
  Megaphone,
  Settings,
  LogOut,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/research", label: "Research", icon: Search },
      { href: "/templates", label: "Templates", icon: LayoutTemplate },
      { href: "/generate", label: "Generate", icon: Sparkles },
      { href: "/content", label: "Content", icon: Library },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/amplify", label: "Amplify", icon: Megaphone },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <aside className="w-[240px] min-h-screen bg-[var(--surface-base)] text-zinc-400 flex flex-col border-r border-[var(--border-subtle)]">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-[var(--border-subtle)]">
        <Link href="/" className="block">
          <h1 className="text-lg font-bold text-zinc-100 tracking-tight">
            Marketing<span className="text-indigo-400">AI</span>
          </h1>
          <p className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-widest font-medium">
            AI Marketing Engine
          </p>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx}>
            {section.label && (
              <div className="px-3 mb-1.5 text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium
                      transition-all duration-150
                      ${
                        isActive
                          ? "bg-[var(--accent-muted)] text-indigo-400 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.15)]"
                          : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
                      }
                    `}
                  >
                    <item.icon
                      size={16}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 space-y-1">
        <Link
          href="/settings"
          className={`
            flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium
            transition-all duration-150
            ${
              pathname === "/settings"
                ? "bg-[var(--accent-muted)] text-indigo-400"
                : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
            }
          `}
        >
          <Settings size={16} />
          Settings
        </Link>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-zinc-600 hover:bg-zinc-800/40 hover:text-zinc-400 transition-all duration-150 w-full"
        >
          <LogOut size={16} />
          Sign Out
        </button>
        <div className="px-3 pt-2 border-t border-[var(--border-subtle)]">
          <span className="text-[10px] text-zinc-700 font-mono">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
