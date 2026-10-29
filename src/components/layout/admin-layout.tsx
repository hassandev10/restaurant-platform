"use client";

import React, { useState } from "react";
import { AuthGuard } from "@/components/shared/auth-guard";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
}

export function AdminLayout({
  children,
  pageTitle,
  pageSubtitle,
}: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="min-h-screen flex bg-cream-100 text-stone-900 antialiased font-cairo">
        {/* Navigation Sidebar */}
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <Header
            onOpenMobileMenu={() => setMobileOpen(true)}
            pageTitle={pageTitle}
            pageSubtitle={pageSubtitle}
          />

          <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
