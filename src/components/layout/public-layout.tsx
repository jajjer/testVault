import { Link, Outlet } from "react-router-dom";

import { ThemeToggle } from "@/components/theme-toggle";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 lg:px-6">
        <Link
          to="/projects"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Test Vault
        </Link>
        <ThemeToggle />
      </header>
      <Outlet />
    </div>
  );
}
