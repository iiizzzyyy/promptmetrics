"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  BarChart3,
  Activity,
  Shield,
  Tags,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const AdminSidebar = () => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
    { href: "/prompts", icon: MessageSquare, label: "Prompts" },
    { href: "/logs", icon: FileText, label: "Logs" },
    { href: "/traces", icon: Activity, label: "Traces" },
    { href: "/runs", icon: BarChart3, label: "Runs" },
    { href: "/evaluations", icon: Shield, label: "Evaluations" },
    { href: "/labels", icon: Tags, label: "Labels" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (path: string, exact?: boolean) =>
    exact ? pathname === path : pathname === path || pathname.startsWith(path + "/");

  return (
    <>
      <button
        className="md:hidden fixed top-[50px] left-0 z-50
             w-0 h-0
             border-t-[14px] border-b-[14px] border-transparent
             border-l-[18px] border-l-primary
             bg-transparent
             active:scale-95 transition"
        onClick={() => setOpen(true)}
      />

      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "w-64 bg-card border-r md:min-h-[calc(100vh-65px)] min-h-screen fixed md:static top-0 left-0 z-50 md:z-10 transform transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-end md:hidden py-4 relative">
          <button
            onClick={() => setOpen(false)}
            className="
            absolute top-[50px]
              w-0 h-0
              border-t-[14px] border-b-[14px] border-transparent
              border-r-[18px] border-r-primary
              bg-transparent
              active:scale-95 transition
            "
          />
        </div>

        <div className="md:p-6 p-4">
          <h2 className="text-2xl font-bold mb-6">Observability</h2>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-xl transition-colors",
                  isActive(item.href, item.exact)
                    ? "bg-primarygradient text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
};
